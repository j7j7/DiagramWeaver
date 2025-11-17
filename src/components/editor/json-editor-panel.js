"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonEditorPanel = JsonEditorPanel;
var react_1 = require("react");
var react_codemirror_1 = require("@uiw/react-codemirror");
var lang_json_1 = require("@codemirror/lang-json");
var lint_1 = require("@codemirror/lint");
var theme_one_dark_1 = require("@codemirror/theme-one-dark");
var schemas_1 = require("@/lib/schemas");
var json_utils_1 = require("@/lib/json-utils");
var nested_hierarchy_1 = require("@/lib/nested-hierarchy");
var json_diff_1 = require("@/lib/json-diff");
// Feature flag: selective JSON text updates are currently disabled to guarantee
// correctness of the editor output when performing complex hierarchical moves.
// Once json-diff path resolution covers all add/remove/move cases safely,
// this can be flipped back on.
var ENABLE_SELECTIVE_JSON_UPDATES = false;
function JsonEditorPanel(_a) {
    var _this = this;
    var value = _a.value, onValidJsonChange = _a.onValidJsonChange, isOpen = _a.isOpen, onToggleOpen = _a.onToggleOpen, widthPx = _a.widthPx;
    var _b = react_1.default.useState(function () { return (0, json_utils_1.stableStringify)(value); }), text = _b[0], setText = _b[1];
    var _c = react_1.default.useState(null), error = _c[0], setError = _c[1];
    var editorRef = react_1.default.useRef(null);
    var editorContainerRef = react_1.default.useRef(null);
    var _d = react_1.default.useState(0), editorHeight = _d[0], setEditorHeight = _d[1];
    var _e = react_1.default.useState(widthPx), panelWidth = _e[0], setPanelWidth = _e[1];
    var scrollPositionRef = react_1.default.useRef({ scrollLeft: 0, scrollTop: 0 });
    var lockedScrollPosition = react_1.default.useRef({ scrollLeft: 0, scrollTop: 0, isLocked: false });
    // Performance optimization: track previous data for diffing
    // Track previous external value to detect real upstream changes
    var previousValueRef = react_1.default.useRef(null);
    var previousNestedDataRef = react_1.default.useRef(null);
    var _f = react_1.default.useState(false), isUpdating = _f[0], setIsUpdating = _f[1];
    var isApplyingExternalUpdate = react_1.default.useRef(false);
    // Responsive panel width based on viewport
    react_1.default.useEffect(function () {
        var updateWidth = function () {
            if (typeof window === 'undefined')
                return;
            var maxWidth = Math.max(300, window.innerWidth * 0.35);
            var clamped = Math.min(Math.max(280, widthPx), maxWidth);
            setPanelWidth(clamped);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return function () { return window.removeEventListener('resize', updateWidth); };
    }, [widthPx]);
    // Track editor container height for CodeMirror scrolling
    react_1.default.useEffect(function () {
        if (!isOpen)
            return;
        var element = editorContainerRef.current;
        if (!element || typeof ResizeObserver === 'undefined')
            return;
        var updateHeight = function () {
            var rect = element.getBoundingClientRect();
            setEditorHeight(rect.height);
        };
        updateHeight();
        var observer = new ResizeObserver(function (entries) {
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                var entry = entries_1[_i];
                setEditorHeight(entry.contentRect.height);
            }
        });
        observer.observe(element);
        return function () { return observer.disconnect(); };
    }, [isOpen]);
    // Check if data is in nested format (has zones with nested children objects)
    var isNestedFormat = react_1.default.useCallback(function (data) {
        console.log('Checking nested format for data:', data);
        // Nested format has zones array but NO nodes array at root level
        // Instead, nodes are nested inside zones as children objects
        var hasNodesArray = Array.isArray(data.nodes) && data.nodes.length > 0;
        var hasZonesArray = Array.isArray(data.zones) && data.zones.length > 0;
        console.log('Has nodes array:', hasNodesArray, 'Has zones array:', hasZonesArray);
        if (!hasZonesArray) {
            console.log('No zones array - not nested format');
            return false;
        }
        // If we have both nodes and zones at root, it's flat format
        if (hasNodesArray) {
            console.log('Has both nodes and zones at root - flat format');
            return false;
        }
        // Check if any zone has children that are objects (not just IDs)
        var hasNestedChildren = data.zones.some(function (zone) {
            if (!zone.children || !Array.isArray(zone.children))
                return false;
            // In nested format, children are objects with type, id, etc.
            // In flat format, children are just string IDs
            return zone.children.length > 0 && typeof zone.children[0] === 'object';
        });
        console.log('Has nested children objects:', hasNestedChildren);
        return hasNestedChildren;
    }, []);
    // Debounced update to prevent flickering during rapid changes (like dragging)
    var updateTimeoutRef = (0, react_1.useRef)();
    // Sync text display when value prop changes from outside - optimized with selective updates
    react_1.default.useEffect(function () {
        // Skip update if we're already processing a change from the editor
        if (isUpdating)
            return;
        // Only react when the external value object actually changes.
        // This prevents in-progress JSON edits from being overwritten by
        // the last good value when the user still has invalid JSON.
        if (previousValueRef.current === value) {
            return;
        }
        // Clear any existing timeout
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        // Reduced debounce delay for more responsive updates
        updateTimeoutRef.current = setTimeout(function () {
            var currentNestedData = isNestedFormat(value) ? value : (0, nested_hierarchy_1.convertToNestedHierarchy)(value);
            var previousNestedData = previousNestedDataRef.current;
            // If we have previous data and selective updates are enabled, compute diff
            // and attempt minimal text patches. This is currently disabled by
            // ENABLE_SELECTIVE_JSON_UPDATES to guarantee correctness when moving
            // items between zones (where path resolution is not yet robust).
            if (ENABLE_SELECTIVE_JSON_UPDATES && previousNestedData) {
                var diffs = (0, json_diff_1.computeHierarchicalDiff)(previousNestedData, currentNestedData);
                // Improved detection for when to use selective updates
                var shouldUseSelectiveUpdate = diffs.length > 0 &&
                    diffs.length < 50 && // Not too many changes
                    !diffs.some(function (diff) { return diff.change === 'moved'; }) && // No structural moves
                    !diffs.some(function (diff) { return diff.type === 'zone_structure'; }); // No zone structure changes
                if (shouldUseSelectiveUpdate) {
                    try {
                        var currentText = text;
                        var patches = [];
                        for (var _i = 0, diffs_1 = diffs; _i < diffs_1.length; _i++) {
                            var diff = diffs_1[_i];
                            var path = getJsonPathFromDiff(diff, currentNestedData);
                            if (!path)
                                continue;
                            var op = void 0;
                            if (diff.change === 'removed') {
                                op = 'remove';
                            }
                            else if (diff.change === 'added') {
                                op = 'add';
                            }
                            else {
                                op = 'replace';
                            }
                            var patch = {
                                op: op,
                                path: path
                            };
                            if (op !== 'remove') {
                                patch.value = diff.newValue;
                            }
                            patches.push(patch);
                        }
                        if (patches.length > 0) {
                            var updatedText = (0, json_diff_1.applySelectiveUpdates)(currentText, patches);
                            if (updatedText !== currentText) {
                                // Try to capture scroll position, but don't fail if we can't
                                var scrollPos_1 = captureScrollPosition();
                                // Always restore using locked position logic
                                setTimeout(function () {
                                    restoreScrollPosition(scrollPos_1);
                                }, 0);
                                setText(updatedText);
                                previousNestedDataRef.current = currentNestedData;
                                previousValueRef.current = value;
                                return; // Skip full refresh
                            }
                        }
                    }
                    catch (error) {
                        console.warn('Selective update failed, falling back to full refresh:', error);
                    }
                }
            }
            // Fallback to full refresh for all changes (current default) or when
            // selective updates are disabled/fail
            // Try to capture scroll position
            var scrollPos = captureScrollPosition();
            var displayText = (0, json_utils_1.stableStringify)(currentNestedData);
            setText(displayText);
            // Restore scroll position after text update
            setTimeout(function () {
                restoreScrollPosition(scrollPos);
            }, 0);
            previousNestedDataRef.current = currentNestedData;
            previousValueRef.current = value;
        }, 16); // ~60fps for smoother updates
        // Cleanup timeout on unmount
        return function () {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, [value, isNestedFormat, isUpdating, text]);
    // Helper function to capture scroll position (doesn't update locked position)
    var captureScrollPosition = react_1.default.useCallback(function () {
        if (!editorRef.current)
            return null;
        var view = editorRef.current;
        var scrollTop = view.scrollDOM.scrollTop;
        var scrollLeft = view.scrollDOM.scrollLeft;
        return {
            scrollTop: scrollTop,
            scrollLeft: scrollLeft
        };
    }, []);
    // Helper function to lock current scroll position (called on explicit user clicks)
    var lockScrollPosition = react_1.default.useCallback(function () {
        if (!editorRef.current)
            return;
        var view = editorRef.current;
        var scrollTop = view.scrollDOM.scrollTop;
        var scrollLeft = view.scrollDOM.scrollLeft;
        lockedScrollPosition.current = {
            scrollTop: scrollTop,
            scrollLeft: scrollLeft,
            isLocked: true
        };
    }, []);
    // Helper function to restore scroll position
    var restoreScrollPosition = react_1.default.useCallback(function (scrollPos) {
        if (!editorRef.current)
            return;
        var view = editorRef.current;
        isApplyingExternalUpdate.current = true;
        // Use locked position if available, otherwise use current position
        var targetScrollTop, targetScrollLeft;
        if (lockedScrollPosition.current.isLocked) {
            targetScrollTop = lockedScrollPosition.current.scrollTop;
            targetScrollLeft = lockedScrollPosition.current.scrollLeft;
        }
        else if (scrollPos) {
            targetScrollTop = scrollPos.scrollTop;
            targetScrollLeft = scrollPos.scrollLeft;
        }
        else {
            // Fallback to current scroll position
            targetScrollTop = view.scrollDOM.scrollTop;
            targetScrollLeft = view.scrollDOM.scrollLeft;
        }
        // Restore scroll position immediately
        view.scrollDOM.scrollLeft = targetScrollLeft;
        view.scrollDOM.scrollTop = targetScrollTop;
        // Reset the flag after a short delay
        setTimeout(function () {
            isApplyingExternalUpdate.current = false;
        }, 50);
    }, []);
    // Helper function to convert diff to JSON path
    var getJsonPathFromDiff = function (diff, data) {
        if (diff.type === 'connection') {
            var id = diff.id || '';
            var _a = id.split('-'), from_1 = _a[0], to_1 = _a[1];
            var index = data.connections.findIndex(function (c) { return c.from === from_1 && c.to === to_1; });
            return index >= 0 ? "/connections/".concat(index) : '';
        }
        if (diff.type === 'zone' || diff.type === 'node') {
            if (diff.path && diff.path.length > 0) {
                // Nested item - find zone and child indices
                var zoneId_1 = diff.path[0];
                var zoneIndex = data.zones.findIndex(function (z) { return z.id === zoneId_1; });
                if (zoneIndex === -1)
                    return '';
                var zone = data.zones[zoneIndex];
                if (!zone.children)
                    return "/zones/".concat(zoneIndex);
                var childIndex = zone.children.findIndex(function (c) { return c.id === diff.id; });
                return childIndex >= 0 ? "/zones/".concat(zoneIndex, "/children/").concat(childIndex) : "/zones/".concat(zoneIndex);
            }
            else {
                // Root zone
                var index = data.zones.findIndex(function (z) { return z.id === diff.id; });
                return index >= 0 ? "/zones/".concat(index) : '';
            }
        }
        return '';
    };
    var handleChange = function (newText) { return __awaiter(_this, void 0, void 0, function () {
        var parsed, finalData_1, validationError, validationResult, displayText, scrollPos_2, errorMessage;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            // Skip handling if we're applying an external update
            if (isApplyingExternalUpdate.current)
                return [2 /*return*/];
            setIsUpdating(true);
            setText(newText);
            try {
                parsed = JSON.parse(newText);
                console.log('JSON Editor parsed data:', {
                    isNested: isNestedFormat(parsed),
                    nodesCount: ((_a = parsed.nodes) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    zonesCount: ((_b = parsed.zones) === null || _b === void 0 ? void 0 : _b.length) || 0,
                    connectionsCount: ((_c = parsed.connections) === null || _c === void 0 ? void 0 : _c.length) || 0,
                    sampleNode: (_d = parsed.nodes) === null || _d === void 0 ? void 0 : _d[0],
                    sampleZone: (_e = parsed.zones) === null || _e === void 0 ? void 0 : _e[0],
                    allNodeIds: (_f = parsed.nodes) === null || _f === void 0 ? void 0 : _f.map(function (n) { return n.id; })
                });
                finalData_1 = null;
                validationError = null;
                // Check if data is in nested format
                if (isNestedFormat(parsed)) {
                    validationResult = schemas_1.HierarchicalDiagramDataSchema.safeParse(parsed);
                    if (validationResult.success) {
                        // Convert nested to flat for application
                        finalData_1 = (0, nested_hierarchy_1.convertFromNestedHierarchy)(parsed);
                    }
                    else {
                        validationError = validationResult.error;
                    }
                }
                else {
                    // Data is already in flat format, just validate basic structure
                    if (parsed && typeof parsed === 'object' && (parsed.nodes || parsed.zones || parsed.connections)) {
                        finalData_1 = {
                            nodes: parsed.nodes || [],
                            zones: parsed.zones || [],
                            connections: parsed.connections || []
                        };
                    }
                    else {
                        validationError = { message: 'Invalid diagram data structure' };
                    }
                }
                if (!validationError && finalData_1) {
                    console.log('JSON Editor emitting valid data:', {
                        nodesCount: ((_g = finalData_1.nodes) === null || _g === void 0 ? void 0 : _g.length) || 0,
                        zonesCount: ((_h = finalData_1.zones) === null || _h === void 0 ? void 0 : _h.length) || 0,
                        connectionsCount: ((_j = finalData_1.connections) === null || _j === void 0 ? void 0 : _j.length) || 0,
                        sampleNode: (_k = finalData_1.nodes) === null || _k === void 0 ? void 0 : _k[0],
                        sampleZone: (_l = finalData_1.zones) === null || _l === void 0 ? void 0 : _l[0],
                        allNodeIds: (_m = finalData_1.nodes) === null || _m === void 0 ? void 0 : _m.map(function (n) { return n.id; }),
                        allZoneIds: (_o = finalData_1.zones) === null || _o === void 0 ? void 0 : _o.map(function (z) { return z.id; }),
                        hasDuplicateNodeIds: !!((_p = finalData_1.nodes) === null || _p === void 0 ? void 0 : _p.some(function (node, index) {
                            return finalData_1.nodes.findIndex(function (n) { return n.id === node.id; }) !== index;
                        }))
                    });
                    setError(null);
                    onValidJsonChange(finalData_1);
                    displayText = (0, json_utils_1.stableStringify)(isNestedFormat(parsed) ? parsed : (0, nested_hierarchy_1.convertToNestedHierarchy)(finalData_1));
                    if (displayText !== text) {
                        scrollPos_2 = captureScrollPosition();
                        setText(displayText);
                        // Restore scroll position after text update
                        setTimeout(function () {
                            restoreScrollPosition(scrollPos_2);
                        }, 0);
                    }
                }
                else {
                    errorMessage = validationError.issues
                        ? validationError.issues.map(function (issue) { return "".concat(issue.path.join('.'), ": ").concat(issue.message); }).join(', ')
                        : validationError.message || 'Unknown validation error';
                    setError("Schema validation failed: ".concat(errorMessage));
                }
            }
            catch (e) {
                setError((e === null || e === void 0 ? void 0 : e.message) || 'Invalid JSON');
            }
            finally {
                setIsUpdating(false);
            }
            return [2 /*return*/];
        });
    }); };
    return (<div className="flex flex-col h-full max-h-full bg-background border-l overflow-y-auto" style={{ width: "".concat(panelWidth, "px") }}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50 flex-shrink-0">
        <div className="text-sm font-medium">JSON Editor</div>
        <button onClick={onToggleOpen} className="p-1 rounded hover:bg-muted transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Editor */}
      <div ref={editorContainerRef} className="flex-1 min-h-0">
        {isOpen ? (<div className="h-full max-h-[calc(100vh-80px)] overflow-y-scroll">
            <react_codemirror_1.default value={text} height="auto" theme={theme_one_dark_1.oneDark} onChange={handleChange} extensions={[(0, lang_json_1.json)(), (0, lint_1.lintGutter)()]} basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                foldGutter: true,
                autocompletion: true,
                bracketMatching: true,
                searchKeymap: true,
            }} editable={true} onCreateEditor={function (view) {
                editorRef.current = view;
                // Only lock position on explicit clicks
                var handleClick = function (event) {
                    if (!view || isApplyingExternalUpdate.current)
                        return;
                    // Only lock on left clicks within the editor content
                    if (event.button === 0 && event.target === view.contentDOM) {
                        setTimeout(function () {
                            lockScrollPosition();
                        }, 10); // Small delay to ensure scroll position is updated after click
                    }
                };
                // Track scroll but don't update locked position
                var handleScroll = function () {
                    // Don't update locked position on scroll - only on clicks
                };
                view.dom.addEventListener('click', handleClick);
                view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true });
                // Initial lock to current position
                setTimeout(function () {
                    lockScrollPosition();
                }, 100);
            }}/>
          </div>) : null}
      </div>

      {/* Error footer */}
      {error && (<div className="px-3 py-2 text-xs text-destructive bg-destructive/5 border-t max-h-20 overflow-y-auto">
          <div className="font-medium mb-1">Validation Error:</div>
          <div className="text-muted-foreground">{error}</div>
        </div>)}
    </div>);
}
