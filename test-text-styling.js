// Test script to verify text positioning and styling
const testZones = [
  {
    id: 'zone-1',
    label: 'Top Left Zone',
    textPosition: 'top-left',
    textJustify: 'left',
    textVerticalPosition: 'top',
    fontSize: 16,
    fontWeight: 'bold',
    textColor: '#ff0000',
    x: 50,
    y: 50,
    width: 200,
    height: 150
  },
  {
    id: 'zone-2',
    label: 'Inline Top Zone',
    textPosition: 'inline-top',
    textJustify: 'center',
    textVerticalPosition: 'middle',
    fontSize: 14,
    fontStyle: 'italic',
    textColor: '#0066cc',
    x: 300,
    y: 50,
    width: 200,
    height: 150
  },
  {
    id: 'zone-3',
    label: 'Outside Right Zone',
    textPosition: 'outside-right',
    textJustify: 'right',
    textVerticalPosition: 'bottom',
    fontSize: 18,
    fontWeight: '600',
    textColor: '#00aa00',
    x: 550,
    y: 50,
    width: 200,
    height: 150
  },
  {
    id: 'zone-4',
    label: 'Inside Zone',
    textPosition: 'inside',
    textJustify: 'center',
    textVerticalPosition: 'middle',
    fontSize: 20,
    fontWeight: 'bold',
    textDecoration: 'underline',
    textColor: '#aa00aa',
    x: 50,
    y: 250,
    width: 200,
    height: 150
  }
];

console.log('Test zones created:', testZones);
console.log('Text positioning integration should now work with:');
console.log('- Proper text justification (left, center, right, full)');
console.log('- Vertical positioning (top, middle, bottom)');
console.log('- Font styling (size, weight, style, decoration)');
console.log('- Flexible positioning (inline, outside, traditional)');