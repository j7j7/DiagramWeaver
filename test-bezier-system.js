// Test script to verify bezier connection system
const fs = require('fs');

// Read the test diagram
const testDiagram = JSON.parse(fs.readFileSync('./test-bezier-connections.json', 'utf8'));

console.log('🧪 Testing Bezier Connection System');
console.log('=====================================');

// Test 1: Verify connections have correct properties
console.log('\n✅ Test 1: Connection Properties');
testDiagram.connections.forEach((conn, index) => {
  console.log(`Connection ${index + 1}:`);
  console.log(`  From: ${conn.from} → To: ${conn.to}`);
  console.log(`  Style: ${conn.style || 'pathways'}`);
  if (conn.style === 'bezier') {
    console.log(`  Curvature: ${conn.curvature || 0.5}`);
  }
  console.log(`  Text: ${conn.text || 'none'}`);
  console.log(`  Arrows: From=${conn.fromArrow || false}, To=${conn.toArrow || false}`);
});

// Test 2: Verify bezier connections have curvature
console.log('\n✅ Test 2: Bezier Curvature Validation');
const bezierConnections = testDiagram.connections.filter(c => c.style === 'bezier');
bezierConnections.forEach((conn, index) => {
  const hasCurvature = conn.curvature !== undefined && conn.curvature >= 0.1 && conn.curvature <= 1.0;
  console.log(`Bezier Connection ${index + 1}: ${hasCurvature ? '✅' : '❌'} Curvature=${conn.curvature || 'missing'}`);
});

// Test 3: Verify pathways connections don't have curvature
console.log('\n✅ Test 3: Pathways Consistency');
const pathwaysConnections = testDiagram.connections.filter(c => c.style !== 'bezier');
pathwaysConnections.forEach((conn, index) => {
  const noCurvature = conn.curvature === undefined;
  console.log(`Pathways Connection ${index + 1}: ${noCurvature ? '✅' : '❌'} Has curvature=${!noCurvature}`);
});

console.log('\n🎉 Bezier Connection System Test Complete!');
console.log('\n📋 Summary:');
console.log(`- Total connections: ${testDiagram.connections.length}`);
console.log(`- Bezier connections: ${bezierConnections.length}`);
console.log(`- Pathways connections: ${pathwaysConnections.length}`);
console.log('\n🔧 To test in the app:');
console.log('1. Open DiagramWeaver in browser');
console.log('2. Load test-bezier-connections.json');
console.log('3. Verify curved and straight lines render correctly');
console.log('4. Try creating new connections with different styles');