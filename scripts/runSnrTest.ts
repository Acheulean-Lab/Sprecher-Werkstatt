import { snrSelfTest } from '../src/engine/snrSelfTest';

const r = snrSelfTest();
process.exit(r.passed ? 0 : 1);
