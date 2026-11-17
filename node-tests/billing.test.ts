import { test } from 'node:test';
import assert from 'node:assert/strict';

const b = await import('../src/lib/billing/logic.ts');
const perms = await import('../src/lib/auth/permissions.ts');

test('money reads numbers and decimal strings, anything else is 0', () => {
  assert.equal(b.moneyOf('1250.50'), 1250.5);
  assert.equal(b.moneyOf(300), 300);
  assert.equal(b.moneyOf(''), 0);
  assert.equal(b.moneyOf(null), 0);
  assert.equal(b.moneyOf('abc'), 0);
});

test('the time period defaults to last month, across a year end', () => {
  assert.deepEqual(b.lastMonthRange(new Date(2026, 10, 17)), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(b.lastMonthRange(new Date(2027, 0, 5)), { from: '2026-12-01', to: '2026-12-31' });
  assert.deepEqual(b.lastMonthRange(new Date(2028, 2, 1)), { from: '2028-02-01', to: '2028-02-29' });
  assert.equal(b.monthOf(new Date(2026, 10, 17)), '2026-11');
  assert.equal(b.validPeriod('2026-10-01', '2026-10-31'), true);
  assert.equal(b.validPeriod('2026-11-01', '2026-10-31'), false);
  assert.equal(b.validPeriod('', '2026-10-31'), false);
});

test('prices and percents follow the API rules', () => {
  assert.equal(b.validPrice('150000'), true);
  assert.equal(b.validPrice('99.95'), true);
  assert.equal(b.validPrice('1.234'), false);
  assert.equal(b.validPrice('0'), false);
  assert.equal(b.validPrice('-5'), false);
  assert.equal(b.validPercent('30'), true);
  assert.equal(b.validPercent('12.5'), true);
  assert.equal(b.validPercent('0'), false);
  assert.equal(b.validPercent('101'), false);
});

test('one invoice state: void, then paid, then overdue, then partly paid', () => {
  assert.equal(b.invoiceState({ status: 'void', payment_status: 'paid' }), 'void');
  assert.equal(b.invoiceState({ status: 'cancelled' }), 'void');
  assert.equal(b.invoiceState({ status: 'sent', payment_status: 'paid', is_overdue: true }), 'paid');
  assert.equal(b.invoiceState({ status: 'sent', payment_status: 'partial', is_overdue: true }), 'overdue');
  assert.equal(b.invoiceState({ status: 'sent', payment_status: 'partial' }), 'partial');
  assert.equal(b.invoiceState({ status: 'draft', payment_status: 'unpaid' }), 'draft');
  assert.equal(b.invoiceState({ status: 'sent', payment_status: 'unpaid' }), 'unpaid');
  assert.equal(b.invoiceState({ status: 'approved', payment_status: 'unpaid' }), 'to_send');
  assert.equal(b.INVOICE_STATE_LABEL.to_send, 'Ready to send');
  // A fresh project invoice is a treasury draft (keep_draft) and reads as one.
  assert.equal(b.INVOICE_STATE_LABEL[b.invoiceState({ status: 'draft', payment_status: 'unpaid' })], 'Draft');
  assert.equal(b.INVOICE_STATE_LABEL.partial, 'Partly paid');
  assert.equal(b.isLiveInvoice({ status: 'void' }), false);
  assert.equal(b.isLiveInvoice({ status: 'draft' }), true);
});

test('a milestone invoices only with a client and a price on a billed project', () => {
  const terms = { client_id: 'c1', billing_type: 'fixed' };
  assert.equal(b.milestoneInvoiceBlock({ bill_amount: '30000.00' }, terms), null);
  assert.equal(b.milestoneInvoiceBlock({ amount_pct: 30 }, terms), 'Set a price first.');
  assert.equal(b.milestoneInvoiceBlock({ amount: '500' }, { billing_type: 'fixed' }), 'Set the client on the contract first.');
  assert.equal(b.milestoneInvoiceBlock({ amount: '500' }, { client_id: 'c1', billing_type: 'non_billable' }), 'This project is not billed.');
  assert.equal(b.billAmountOf({ amount_pct: 30, bill_amount: '30000' }), 30000);
});

test('billing errors: the server text first, nothing_to_bill is information', () => {
  assert.deepEqual(b.billingErrorToast('nothing_to_bill', 'no approved billable hours in that period', 'x'), {
    kind: 'info',
    message: 'No approved billable hours in that period',
  });
  assert.deepEqual(b.billingErrorToast('nothing_to_bill', undefined, 'x').kind, 'info');
  assert.equal(b.billingErrorToast('invoice_in_progress', 'an invoice is being created.', 'x').message, 'An invoice is being created. Try again in a moment.');
  assert.equal(b.billingErrorToast('treasury_refused', 'customer not found', 'x').message, 'Customer not found');
  assert.equal(b.billingErrorToast(undefined, undefined, 'The invoice was not created').message, 'The invoice was not created');
});

test('treasury links and pay links', () => {
  assert.equal(b.treasuryInvoiceUrl('https://books.example.test/', 'acme', 'inv-1'), 'https://books.example.test/acme/invoices/inv-1');
  assert.equal(b.safePayUrl('https://pay.example.test/i/abc'), 'https://pay.example.test/i/abc');
  assert.equal(b.safePayUrl('javascript:alert(1)'), null);
  assert.equal(b.safePayUrl(''), null);
});

test('billing permissions: manage implies view, the project manager can bill', () => {
  assert.equal(perms.holds({ permissions: ['projects.billing.manage'], bypass: false }, 'projects.billing.view'), true);
  assert.equal(perms.permissionName('projects.billing.view'), 'View project billing and invoices');
  assert.equal(perms.permissionName('projects.billing.manage'), 'Create project invoices');
  assert.ok(perms.ROLE_PERMISSIONS.project_manager.includes('projects.billing.manage'));
  assert.equal(perms.ROLE_PERMISSIONS.viewer.includes('projects.billing.view'), false);
});
