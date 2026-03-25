/**
 * Phase D — React Stability Audit
 * Verifies: fetch cleanup, timers, event listeners, chart memory, WebSocket leaks, types, auth, CORS
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

function findFiles(dir: string, pattern: RegExp): string[] {
  const files: string[] = [];
  try {
    const items = readdirSync(join(srcDir, dir));
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(join(srcDir, fullPath));
      if (stat.isDirectory()) {
        files.push(...findFiles(fullPath, pattern));
      } else if (pattern.test(item)) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
  return files;
}

// 1. Fetch Cleanup Audit
function auditFetchCleanup() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  
  for (const file of files) {
    const content = readFileContent(file);
    if (content.includes('fetch(')) {
      const hasAbortController = content.includes('AbortController') && content.includes('signal');
      const hasCleanup = content.includes('controller.abort()') || content.includes('clearTimeout');
      
      addCheck('Fetch Cleanup', `${file}: AbortController usage`, hasAbortController);
      addCheck('Fetch Cleanup', `${file}: Cleanup on unmount`, hasCleanup);
    }
  }
  
  // Also check ApiClient for AbortSignal support
  const apiClientContent = readFileContent('lib/apiClient.ts');
  const hasAbortSignalSupport = apiClientContent.includes('AbortError') && apiClientContent.includes('signal');
  addCheck('Fetch Cleanup', 'ApiClient: AbortSignal support', hasAbortSignalSupport);
}

// 2. Timer Cleanup Audit
function auditTimerCleanup() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  
  for (const file of files) {
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

// 3. Event Listener Cleanup Audit
function auditEventListenerCleanup() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  
  for (const file of files) {
    const content = readFileContent(file);
    if (content.includes('addEventListener(')) {
      const hasRemoveListener = content.includes('removeEventListener(');
      const hasCleanupReturn = content.includes('return () =>') && content.includes('removeEventListener');
      
      addCheck('Event Listener Cleanup', `${file}: removeEventListener`, hasRemoveListener);
      addCheck('Event Listener Cleanup', `${file}: Cleanup in useEffect return`, hasCleanupReturn);
    }
  }
}

// 4. Chart Memory Audit
function auditChartMemory() {
  const chartFiles = findFiles('.', /.*[Cc]hart.*\.(tsx?|jsx?)$/);
  
  for (const file of chartFiles) {
    const content = readFileContent(file);
    const hasResponsiveContainer = content.includes('ResponsiveContainer');
    const hasAnimationDisabled = content.includes('isAnimationActive={false}');
    
    addCheck('Chart Memory', `${file}: ResponsiveContainer usage`, hasResponsiveContainer);
    addCheck('Chart Memory', `${file}: Animations disabled`, hasAnimationDisabled);
  }
}

// 5. WebSocket Leak Audit
function auditWebSocketLeaks() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  let hasWebSocket = false;
  
  for (const file of files) {
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

// 6. Type Safety Audit
function auditTypeSafety() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  
  for (const file of files) {
    const content = readFileContent(file);
    const hasAnyType = content.includes(': any') || content.includes('as any');
    const hasApiTypes = content.includes('from ') && content.includes('/types/api');
    
    addCheck('Type Safety', `${file}: No 'any' types`, !hasAnyType);
    addCheck('Type Safety', `${file}: Uses API types`, hasApiTypes);
  }
}

// 7. Backend Security Audit (check for CORS patterns)
function auditBackendSecurity() {
  const apiFiles = findFiles('./app/api', /\.(ts|js)$/);
  
  for (const file of apiFiles) {
    const content = readFileContent(file);
    const hasCorsWhitelist = content.includes('origins') && content.includes('ALLOWED_ORIGINS');
    const hasRateLimit = content.includes('rate') && content.includes('limit');
    const hasAuthCheck = content.includes('auth') || content.includes('token') || content.includes('clerk');
    
    addCheck('Backend Security', `${file}: CORS whitelist`, hasCorsWhitelist);
    addCheck('Backend Security', `${file}: Rate limiting`, hasRateLimit);
    addCheck('Backend Security', `${file}: Auth required`, hasAuthCheck);
  }
}

// 8. Frontend Auth Audit
function auditFrontendAuth() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  
  for (const file of files) {
    const content = readFileContent(file);
    const hasProtectedRoute = content.includes('useAuth') || content.includes('isAuthenticated');
    const hasTokenInApi = content.includes('Authorization') && content.includes('Bearer');
    
    addCheck('Frontend Auth', `${file}: Protected route checks`, hasProtectedRoute);
    addCheck('Frontend Auth', `${file}: Token in API calls`, hasTokenInApi);
  }
}

// 9. Memory Leak Patterns Audit
function auditMemoryLeakPatterns() {
  const files = findFiles('.', /\.(tsx?|jsx?)$/);
  
  for (const file of files) {
    const content = readFileContent(file);
    // Only check files that actually use useEffect
    if (content.includes('useEffect')) {
      const hasUseEffectReturn = content.includes('useEffect') && content.includes('return () =>');
      const hasProperDeps = content.includes('useEffect') && (content.includes('}, [') || content.includes('}, []'));
      
      addCheck('Memory Leak Prevention', `${file}: useEffect cleanup`, hasUseEffectReturn);
      addCheck('Memory Leak Prevention', `${file}: Proper dependency array`, hasProperDeps);
    }
  }
}

// Run all audits
console.log('🔍 Starting Phase D — React Stability Audit...\n');

auditFetchCleanup();
auditTimerCleanup();
auditEventListenerCleanup();
auditChartMemory();
auditWebSocketLeaks();
auditTypeSafety();
auditBackendSecurity();
auditFrontendAuth();
auditMemoryLeakPatterns();

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
