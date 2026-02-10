#!/usr/bin/env bash
# Pack script to create multiple zip files around 100-200KB each
# Usage:
#   ./pack.sh                    # Pack current directory (excluding node_modules, .next, etc.)
#   ./pack.sh src/               # Pack specific directory
#   ./pack.sh file1.txt file2.js # Pack specific files
#   ./pack.sh --max-size 150     # Set max size per zip in KB (default: 200)
#   ./pack.sh --rename-js        # Rename .js files to .js.txt to bypass Gmail blocks

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

MAX_SIZE_KB=200  # Default max size per zip file in KB
MIN_SIZE_KB=100   # Minimum size to aim for (will create new zip if current is below this and adding would exceed max)
OUTPUT_DIR="packs"
PACK_PREFIX="pack"
RENAME_JS=0  # Whether to rename .js files to .js.txt to bypass Gmail blocks

# Parse arguments
TARGETS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-size)
      MAX_SIZE_KB="$2"
      shift 2
      ;;
    --min-size)
      MIN_SIZE_KB="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --prefix)
      PACK_PREFIX="$2"
      shift 2
      ;;
    --rename-js)
      RENAME_JS=1
      shift
      ;;
    *)
      TARGETS+=("$1")
      shift
      ;;
  esac
done

# If no targets specified, pack current directory (excluding common build/cache dirs)
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "[pack] No targets specified, packing current directory (excluding node_modules, .next, etc.)"
  TARGETS=(".")
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to get file size in KB
get_size_kb() {
  local file="$1"
  if [[ -f "$file" ]]; then
    du -k "$file" | cut -f1
  else
    echo "0"
  fi
}

# Function to get total size of files in array
get_total_size_kb() {
  local total=0
  local files=("$@")
  for file in "${files[@]}"; do
    if [[ -f "$file" ]]; then
      local size=$(get_size_kb "$file")
      total=$((total + size))
    fi
  done
  echo "$total"
}

# Collect all files to pack (excluding common directories and Gmail-blocked file types)
collect_files() {
  local targets=("$@")
  local files=()
  local excluded_extensions=(
    ".mjs" ".jse" ".vbs" ".vbe" ".vb" ".bat" ".cmd" ".com" ".exe" ".ex" ".ex_"
    ".ps1" ".sh" ".shb" ".jar" ".apk" ".dll" ".sys" ".scr" ".sct" ".hta" ".msi"
    ".msix" ".appx" ".cab" ".chm" ".cpl" ".dmg" ".img" ".iso" ".lnk" ".pif"
    ".ade" ".adp" ".appxbundle" ".diagcab" ".diagcfg" ".diagpkg" ".ins" ".isp"
    ".jnlp" ".lib" ".mde" ".msc" ".msixbundle" ".msp" ".mst" ".nsh" ".vhd"
    ".vxd" ".wsc" ".wsf" ".wsh" ".xll"
  )
  # .js files are handled separately - excluded unless --rename-js is used
  
  for target in "${targets[@]}"; do
    if [[ -f "$target" ]]; then
      # Check if file extension is blocked
      local ext="${target##*.}"
      local ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
      local is_blocked=false
      
      # Handle .js files specially
      if [[ ".${ext_lower}" == ".js" ]]; then
        if [[ "$RENAME_JS" -eq 1 ]]; then
          # Rename .js to .js.txt for Gmail compatibility
          local renamed_file="${target}.txt"
          cp "$target" "$renamed_file"
          files+=("$renamed_file")
        fi
        # Don't add original .js file
        continue
      fi
      
      # Check other blocked extensions
      for blocked_ext in "${excluded_extensions[@]}"; do
        local blocked_ext_lower=$(echo "$blocked_ext" | tr '[:upper:]' '[:lower:]')
        if [[ ".${ext_lower}" == "${blocked_ext_lower}" ]]; then
          is_blocked=true
          break
        fi
      done
      if [[ "$is_blocked" == false ]]; then
        files+=("$target")
      fi
    elif [[ -d "$target" ]]; then
      # Find all files, excluding common build/cache directories and blocked extensions
      while IFS= read -r -d '' file; do
        local ext="${file##*.}"
        local ext_lower=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
        local is_blocked=false
        
        # Handle .js files specially
        if [[ ".${ext_lower}" == ".js" ]]; then
          if [[ "$RENAME_JS" -eq 1 ]]; then
            # Rename .js to .js.txt for Gmail compatibility
            local renamed_file="${file}.txt"
            cp "$file" "$renamed_file"
            files+=("$renamed_file")
          fi
          # Don't add original .js file
          continue
        fi
        
        # Check other blocked extensions
        for blocked_ext in "${excluded_extensions[@]}"; do
          local blocked_ext_lower=$(echo "$blocked_ext" | tr '[:upper:]' '[:lower:]')
          if [[ ".${ext_lower}" == "${blocked_ext_lower}" ]]; then
            is_blocked=true
            break
          fi
        done
        if [[ "$is_blocked" == false ]]; then
          files+=("$file")
        fi
      done < <(find "$target" -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/.next/*" \
        ! -path "*/.git/*" \
        ! -path "*/.git" \
        ! -path "*/.DS_Store" \
        ! -path "*/packs/*" \
        ! -name ".DS_Store" \
        -print0 2>/dev/null)
    fi
  done
  
  printf '%s\n' "${files[@]}"
}

# Get all files to pack
echo "[pack] Collecting files..."
if [[ "$RENAME_JS" -eq 1 ]]; then
  echo "[pack] Note: .js files will be renamed to .js.txt to bypass Gmail blocks"
else
  echo "[pack] Note: Gmail-blocked file types (.js, .exe, .bat, etc.) will be excluded"
  echo "[pack]       Use --rename-js to include .js files as .js.txt"
fi
ALL_FILES=($(collect_files "${TARGETS[@]}"))

if [[ ${#ALL_FILES[@]} -eq 0 ]]; then
  echo "[pack] No files found to pack."
  exit 1
fi

echo "[pack] Found ${#ALL_FILES[@]} files to pack (Gmail-blocked types excluded)"
echo "[pack] Target size: ${MIN_SIZE_KB}-${MAX_SIZE_KB}KB per zip file"

# Pack files into multiple zip archives
CURRENT_FILES=()
CURRENT_ZIP_NUM=1
CURRENT_SIZE=0

for file in "${ALL_FILES[@]}"; do
  FILE_SIZE=$(get_size_kb "$file")
  
  # Check if adding this file would exceed max size
  NEW_SIZE=$((CURRENT_SIZE + FILE_SIZE))
  
  # If current zip has some files and adding this would exceed max, finalize current zip
  if [[ ${#CURRENT_FILES[@]} -gt 0 ]] && [[ $NEW_SIZE -gt $MAX_SIZE_KB ]]; then
    ZIP_NAME="${OUTPUT_DIR}/${PACK_PREFIX}-$(printf "%03d" $CURRENT_ZIP_NUM).zip"
    echo "[pack] Creating ${ZIP_NAME} (${CURRENT_SIZE}KB) with ${#CURRENT_FILES[@]} files"
    
    # Create zip file (exclude .git directories)
    zip -q -r "$ZIP_NAME" "${CURRENT_FILES[@]}" -x "*/.git/*" "*/.git"
    
    # Verify size
    ACTUAL_SIZE=$(get_size_kb "$ZIP_NAME")
    echo "[pack]   Created: ${ZIP_NAME} (${ACTUAL_SIZE}KB)"
    
    # Start new zip
    CURRENT_FILES=()
    CURRENT_ZIP_NUM=$((CURRENT_ZIP_NUM + 1))
    CURRENT_SIZE=0
    NEW_SIZE=$FILE_SIZE
  fi
  
  # Add file to current zip
  CURRENT_FILES+=("$file")
  CURRENT_SIZE=$NEW_SIZE
  
  # If we've reached a good size (above min), consider finalizing if next file would push us over max
  # But for now, just keep adding until we hit the max
done

# Create final zip if there are remaining files
if [[ ${#CURRENT_FILES[@]} -gt 0 ]]; then
  ZIP_NAME="${OUTPUT_DIR}/${PACK_PREFIX}-$(printf "%03d" $CURRENT_ZIP_NUM).zip"
  echo "[pack] Creating ${ZIP_NAME} (${CURRENT_SIZE}KB) with ${#CURRENT_FILES[@]} files"
  
  # Create zip file (exclude .git directories)
  zip -q -r "$ZIP_NAME" "${CURRENT_FILES[@]}" -x "*/.git/*" "*/.git"
  
  ACTUAL_SIZE=$(get_size_kb "$ZIP_NAME")
  echo "[pack]   Created: ${ZIP_NAME} (${ACTUAL_SIZE}KB)"
fi

# Cleanup renamed files if we created any
if [[ "$RENAME_JS" -eq 1 ]]; then
  echo "[pack] Cleaning up temporary .js.txt files..."
  find . -name "*.js.txt" -type f -delete 2>/dev/null || true
  echo "[pack] Note: Recipients should rename .js.txt files back to .js after extraction"
fi

# Summary
TOTAL_ZIPS=$CURRENT_ZIP_NUM
echo ""
echo "[pack] Complete! Created ${TOTAL_ZIPS} zip file(s) in ${OUTPUT_DIR}/"
echo "[pack] Files:"
ls -lh "${OUTPUT_DIR}/${PACK_PREFIX}"-*.zip 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
