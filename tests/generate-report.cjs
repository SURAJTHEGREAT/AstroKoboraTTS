const fs = require('fs');

const inputFile = process.argv[2] || 'test-results.json';
const outputFile = process.argv[3] || 'tests/reports/test-results.md';

let data;
try {
  data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} catch (e) {
  console.error(`Error reading or parsing ${inputFile}: ${e.message}`);
  process.exit(1);
}

const date = new Date().toLocaleString();

let passedTests = 0;
let totalTests = 0;

let testSummary = '| Test Suite | Status | Duration (ms) |\n|---|---|---|\n';
let detailedResults = '';

for (const testResult of data.testResults) {
  const isPass = testResult.status === 'passed';
  const statusEmoji = isPass ? '✅ Pass' : '❌ Fail';
  const duration = testResult.endTime - testResult.startTime;
  const suiteName = testResult.name.replace(process.cwd(), '');

  testSummary += `| \`${suiteName}\` | ${statusEmoji} | ${duration} |\n`;

  detailedResults += `### \`${suiteName}\`\n\n`;

  for (const assertion of testResult.assertionResults) {
    totalTests++;
    const assertionPass = assertion.status === 'passed';
    if (assertionPass) passedTests++;
    const assertEmoji = assertionPass ? '✅' : '❌';
    detailedResults += `- ${assertEmoji} **${assertion.title}**\n`;
  }
  detailedResults += '\n';
}

const allPassed = passedTests === totalTests && totalTests > 0;
const finalVerdict = allPassed
  ? `**✅ ALL TESTS PASSED** - TTS Functionality works out of the box.`
  : `**❌ SOME TESTS FAILED** - ${totalTests - passedTests} out of ${totalTests} tests failed.`;

const markdownContent = `# TTS Integration Test Report

*Generated on: ${date}*

## Test Summary

${testSummary}
## Detailed Results

${detailedResults}## Final Verdict

${finalVerdict}
`;

fs.writeFileSync(outputFile, markdownContent, 'utf8');
console.log(`Markdown report generated at ${outputFile}`);
