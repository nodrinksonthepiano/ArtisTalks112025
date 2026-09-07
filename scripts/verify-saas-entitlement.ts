/**
 * Focused checks for Stripe-driven ArtisTalks SaaS entitlement transitions.
 * Run with the repository's installed ts-node binary.
 */
import {
  grantsSaasCurriculumAccess,
  resolveStripeProfileStatusUpdate,
} from '../lib/saasEntitlement'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`)
  }
}

assertEqual(
  resolveStripeProfileStatusUpdate('inactive', 'past_due'),
  null,
  'initial failure must not promote inactive to past_due'
)
assertEqual(
  resolveStripeProfileStatusUpdate(null, 'past_due'),
  null,
  'initial failure must not promote a missing status to past_due'
)
assertEqual(
  resolveStripeProfileStatusUpdate(undefined, 'past_due'),
  null,
  'initial failure must not promote an undefined status to past_due'
)
assertEqual(
  resolveStripeProfileStatusUpdate('unknown', 'past_due'),
  null,
  'initial failure must not promote an unknown status to past_due'
)
assertEqual(
  resolveStripeProfileStatusUpdate('active', 'past_due'),
  'past_due',
  'later failure must move active to past_due'
)
assertEqual(
  resolveStripeProfileStatusUpdate('past_due', 'past_due'),
  null,
  'repeated failure must not rewrite past_due'
)
assertEqual(
  resolveStripeProfileStatusUpdate('comped', 'past_due'),
  null,
  'failure must not overwrite comped'
)

assertEqual(
  resolveStripeProfileStatusUpdate('inactive', 'active'),
  'active',
  'successful payment must activate inactive'
)
assertEqual(
  resolveStripeProfileStatusUpdate(null, 'active'),
  'active',
  'successful payment must activate a missing status'
)
assertEqual(
  resolveStripeProfileStatusUpdate('past_due', 'active'),
  'active',
  'successful payment must restore past_due to active'
)
assertEqual(
  resolveStripeProfileStatusUpdate('comped', 'active'),
  null,
  'successful payment must not overwrite comped'
)

assert(!grantsSaasCurriculumAccess('inactive'), 'inactive must not grant access')
assert(!grantsSaasCurriculumAccess(null), 'missing status must not grant access')
assert(grantsSaasCurriculumAccess('active'), 'active must grant access')
assert(grantsSaasCurriculumAccess('past_due'), 'past_due must retain access')
assert(grantsSaasCurriculumAccess('comped'), 'comped must grant access')

console.log('verify-saas-entitlement: all checks passed')
