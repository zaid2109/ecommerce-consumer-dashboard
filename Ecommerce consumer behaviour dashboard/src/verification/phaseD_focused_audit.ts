/**
 * Phase D — React Stability Focused Audit
 * Only checks critical files and specific issues from the prompts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..');

interface AuditResult {
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    details?: string;
  }>;
}

const results: AuditResult[] = [];

function addCheck(category: string, name: string, passed: boolean, details?: string) {
  let categoryResult = results.find(r => r.category === category);
  if (!categoryResult) {
    categoryResult = { category, checks: [] };
    results.push(categoryResult);
  }
  categoryResult.checks.push({ name, passed, details });
}

function readFileContent(filePath: string): string {
  try {
    return readFileSync(join(srcDir, filePath), 'utf-8');
  } catch {
    return '';
  }
}

// Critical files to check based on the prompts
const criticalFiles = [
  'components/views/analytics/DynamicAnalyticsView.tsx',
  'app/[locale]/data/page.tsx',
  'app/[locale]/scatter/page.tsx',
  'app/[locale]/line/page.tsx',
  'app/[locale]/bars/page.tsx',
  'app/[locale]/area/page.tsx',
  'hooks/auth/useHandleLogin.ts',
  'layout/Layout.tsx',
  'layout/navbar/hooks/useChangelogModal.ts',
  'hooks/useMediaQuery.ts',
  'hooks/useWindowDimensions.ts',
  'hooks/useTooltip.ts',
  'hooks/useModal.ts',
  'hooks/useClickOutside.ts',
  'lib/apiClient.ts'
];

// 1. Fetch Cleanup Audit - Critical Files
function auditFetchCleanup() {
  for (const file of criticalFiles) {
    const content = readFileContent(file);
    if (content.includes('fetch(')) {
      const hasAbortController = content.includes('AbortController') && content.includes('signal');
      const hasCleanup = content.includes('controller.abort()') || content.includes('clearTimeout');
      
      addCheck('Fetch Cleanup', `${file}: AbortController usage`, hasAbortController);
      addCheck('Fetch Cleanup', `${file}: Cleanup on unmount`, hasCleanup);
    }
  }
  
  // Check ApiClient for AbortSignal support
  const apiClientContent = readFileContent('lib/apiClient.ts');
  const hasAbortSignalSupport = apiClientContent.includes('AbortError') && apiClientContent.includes('signal');
  addCheck('Fetch Cleanup', 'ApiClient: AbortSignal support', hasAbortSignalSupport);
}

// 2. Timer Cleanup Audit - Critical Files
function auditTimerCleanup() {
  for (const file of criticalFiles) {
    const content = readFileContent(file);
    if (content.includes('setTimeout(') || content.includes('setInterval(')) {
      const hasClearTimeout = content.includes('clearTimeout') || content.includes('clearInterval');
      const hasRef = content.includes('useRef<ReturnType<typeof setTimeout>');
      const hasCleanupReturn = content.includes('return () =>') && (content.includes('clearTimeout') || content.includes('clearInterval'));
      
      addCheck('Timer Cleanup', `${file}: Timer cleanup`, hasClearTimeout);
      addCheck('Timer Cleanup', `${file}: Timer ref usage`, hasRef);
      addCheck('Timer Cleanup', `${file}: Cleanup in useEffect return`, hasCleanupReturn);
    }
  }
}

// 3. Event Listener Cleanup Audit - Critical Files
function auditEventListenerCleanup() {
  for (const file of criticalFiles) {
    const content = readFileContent(file);
    if (content.includes('addEventListener(')) {
      const hasRemoveListener = content.includes('removeEventListener(');
      const hasCleanupReturn = content.includes('return () =>') && content.includes('removeEventListener');
      
      addCheck('Event Listener Cleanup', `${file}: removeEventListener`, hasRemoveListener);
      addCheck('Event Listener Cleanup', `${file}: Cleanup in useEffect return`, hasCleanupReturn);
    }
  }
}

// 4. Chart Memory Audit - Check for ResponsiveContainer usage
function auditChartMemory() {
  const chartContent = readFileContent('components/views/analytics/DynamicAnalyticsView.tsx');
  const hasResponsiveContainer = chartContent.includes('ResponsiveContainer');
  const hasAnimationDisabled = chartContent.includes('isAnimationActive={false}');
  
  addCheck('Chart Memory', 'DynamicAnalyticsView: ResponsiveContainer usage', hasResponsiveContainer);
  addCheck('Chart Memory', 'DynamicAnalyticsView: Animations disabled', hasAnimationDisabled);
}

// 5. WebSocket Leak Audit
function auditWebSocketLeaks() {
  let hasWebSocket = false;
  
  for (const file of criticalFiles) {
    const content = readFileContent(file);
    if (content.includes('WebSocket(') || content.includes('new WebSocket')) {
      hasWebSocket = true;
      const hasCleanup = content.includes('socket.close()') || content.includes('websocket.close()');
      addCheck('WebSocket Leaks', `${file}: WebSocket cleanup`, hasCleanup);
    }
  }
  
  if (!hasWebSocket) {
    addCheck('WebSocket Leaks', 'No WebSocket usage found', true);
  }
}

// 6. Type Safety Audit - Check for 'any' types in critical files
function auditTypeSafety() {
  for (const file of criticalFiles) {
    const content = readFileContent(file);
    const hasAnyType = content.includes(': any') || content.includes('as any');
    
    addCheck('Type Safety', `${file}: No 'any' types`, !hasAnyType);
  }
}

// 7. Memory Leak Prevention - Check useEffect cleanup in critical files
function auditMemoryLeakPrevention() {
  for (const file of criticalFiles) {
    const content = readFileContent(file);
    if (content.includes('useEffect')) {
      const hasUseEffectReturn = content.includes('useEffect') && content.includes('return () =>');
      const hasProperDeps = content.includes('useEffect') && (content.includes('}, [') || content.includes('}, []'));
      
      addCheck('Memory Leak Prevention', `${file}: useEffect cleanup`, hasUseEffectReturn);
      addCheck('Memory Leak Prevention', `${file}: Proper dependency array`, hasProperDeps);
    }
  }
}

// Run all audits
console.log('🔍 Starting Phase D — React Stability Focused Audit...\n');

auditFetchCleanup();
auditTimerCleanup();
auditEventListenerCleanup();
auditChartMemory();
auditWebSocketLeaks();
auditTypeSafety();
auditMemoryLeakPrevention();

// Print results
let totalChecks = 0;
let totalPassed = 0;

for (const category of results) {
  console.log(`\n📂 ${category.category}`);
  for (const check of category.checks) {
    const status = check.passed ? '✅' : '❌';
    console.log(`  ${status} ${check.name}`);
    if (check.details) {
      console.log(`     ${check.details}`);
    }
    totalChecks++;
    if (check.passed) totalPassed++;
  }
}

console.log(`\n📊 Summary: ${totalPassed}/${totalChecks} checks passed`);

if (totalPassed === totalChecks) {
  console.log('🎉 All Phase D requirements verified successfully!');
  process.exit(0);
} else {
  console.log('⚠️  Some issues found. Please review the failures above.');
  process.exit(1);
}
