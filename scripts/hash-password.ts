/**
 * Prints a password hash for AUTH_USERS.
 *   npm run hash-password -- "MyStrongPassword"
 * Then use it in place of the password:  AUTH_USERS=admin@nyati.com:scrypt.xxxx.yyyy:Admin
 */
import { hashPassword } from '../src/lib/auth/password';

const pw = process.argv[2];
if (!pw) {
  console.error('usage: npm run hash-password -- "the password"');
  process.exit(1);
}
if (pw.length < 8) console.error('warning: use at least 8 characters');
console.log(hashPassword(pw));
