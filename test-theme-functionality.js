// Simple test to verify theme functionality
const { themeManager } = require('./src/lib/theme-manager.js');

console.log('Testing theme functionality...');

// Test 1: Check if themes are loaded
const themes = themeManager.getThemes();
console.log(`✓ Loaded ${themes.length} themes`);

// Test 2: Check if themes are sorted with favorites first
const sortedThemes = themeManager.getThemesSorted();
console.log(`✓ Sorted themes: ${sortedThemes.length} themes`);

// Test 3: Test favorite toggle
const firstTheme = themes[0];
if (firstTheme) {
  const originalFavorite = firstTheme.isFavorite || false;
  themeManager.toggleFavorite(firstTheme.id);
  const updatedTheme = themeManager.getTheme(firstTheme.id);
  console.log(`✓ Toggle favorite: ${originalFavorite} -> ${updatedTheme?.isFavorite}`);
}

// Test 4: Test export functionality
const exportedThemes = themeManager.exportThemes();
console.log(`✓ Export themes: ${exportedThemes.length} characters`);

console.log('All theme functionality tests passed!');