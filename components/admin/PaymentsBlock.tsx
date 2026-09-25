import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Badge, Field, inputClass } from '@/components/admin/ui';
import { formatDateTime, formatMoney } from '@/lib/admin/format';
import { PAYMENT_ENTRY_STATUS_LABELS, PAYMENT_KIND_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/admin/labels';
import { PAYMENT_METHODS } from '@/lib/admin/payments';
import {
  paymentLinkAction,
  recordPaymentAction,
  refundAction,
  reverseAction,
  settlePaymentAction,
} from '@/app/admin/(panel)/payments/actions';

interface Entry {
  id: string;
  kind: 'PAYMENT' | 'REFUND' | 'REVERSAL';
  amount: number;
  signedAmount: number;
  method: 'KASPI' | 'BANK_TRANSFER' | 'CASH' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  reference: string | null;
  note: string | null;
  proofUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  reversesId: string | null;
  reversedBy: { id: string } | null;
  recordedBy: { name: string } | null;
}

interface Props {
  booking: {
    id: string;
    status: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
    paymentLinkUrl: string | null;
    refundAmount: number | null;
  };
  payments: Entry[];
  can: { view: boolean; record: boolean; adjust: boolean };
  hasClientEmail: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PENDING: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-gray-200 text-gray-700',
  REFUNDED: 'bg-gray-200 text-gray-700',
};

/** Payments ledger of one booking: balance, history, and the actions the role allows. */
export function PaymentsBlock({ booking, payments, can, hasClientEmail }: Props) {
  const balance = booking.totalAmount - booking.paidAmount;
  const cancelled = booking.status === 'CANCELLED';
  const methodOptions = PAYMENT_METHODS.map((m) => (
    <option key={m} value={m}>
      {PAYMENT_METHOD_LABELS[m]}
    </option>
  ));

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-text-secondary text-xs">Стоимость</dt>
          <dd className="font-bold">{formatMoney(booking.totalAmount)}</dd>
        </div>
        <div>
          <dt className="text-text-secondary text-xs">Оплачено</dt>
          <dd className="font-bold text-green-700">{formatMoney(booking.paidAmount)}</dd>
        </div>
        <div>
          <dt className="text-text-secondary text-xs">Остаток</dt>
          {/* A cancelled booking owes nothing; money still held is shown as "to refund" in the status line. */}
          <dd className={`font-bold ${balance > 0 && !cancelled ? 'text-red-700' : ''}`}>{cancelled ? '—' : formatMoney(Math.max(0, balance))}</dd>
        </div>
      </dl>
      <p className="text-sm">
        Статус оплаты: <strong>{PAYMENT_STATUS_LABELS[booking.paymentStatus]}</strong>
        {booking.refundAmount != null && cancelled && ` · возврат по правилам: ${formatMoney(booking.refundAmount)}`}
      </p>

      {payments.length === 0 ? (
        <p className="text-sm text-text-secondary">Платежей пока нет.</p>
      ) : (
        <ul className="divide-y divide-border-light text-sm" aria-label="История платежей">
          {payments.map((p) => (
            <li key={p.id} className="py-2">
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{PAYMENT_KIND_LABELS[p.kind]}</strong> · {PAYMENT_METHOD_LABELS[p.method]}{' '}
                  <Badge className={STATUS_STYLE[p.status]}>{PAYMENT_ENTRY_STATUS_LABELS[p.status]}</Badge>
                  {p.reversedBy && <Badge className="bg-gray-200 text-gray-700 ml-1">сторнирован</Badge>}
                </span>
                <span className={`font-semibold whitespace-nowrap ${p.signedAmount < 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {p.signedAmount < 0 ? '−' : '+'}
                  {formatMoney(p.amount)}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {formatDateTime(p.paidAt ?? p.createdAt)} · {p.recordedBy?.name ?? 'система'}
                {p.reference && ` · №${p.reference}`}
                {p.note && ` · ${p.note}`}
              </p>
              {p.proofUrl && (
                <a href={p.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-accent hover:underline">
                  Подтверждение ↗
                </a>
              )}
              {p.status === 'PENDING' && can.record && (
                <ActionForm action={settlePaymentAction} className="flex flex-wrap gap-2 mt-2">
                  <input type="hidden" name="paymentId" value={p.id} />
                  <button type="submit" name="outcome" value="PAID" className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white">
                    Деньги получены
                  </button>
                  <button type="submit" name="outcome" value="FAILED" className="px-3 py-1 rounded-lg text-xs font-semibold border border-border-light">
                    Не прошёл
                  </button>
                </ActionForm>
              )}
              {p.status === 'PAID' && p.kind !== 'REVERSAL' && !p.reversedBy && can.adjust && (
                <details className="mt-1">
                  <summary className="text-xs text-text-secondary cursor-pointer">Сторнировать (ошибочная операция)</summary>
                  <ActionForm action={reverseAction} className="flex flex-wrap gap-2 mt-2 items-end">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <label className="flex-1 min-w-[10rem] text-xs">
                      Причина
                      <input name="reason" required minLength={5} maxLength={1000} className={inputClass} />
                    </label>
                    <SubmitButton variant="danger" confirm="Сторнировать операцию? Будет создана компенсирующая запись в журнале, удалить её нельзя.">Сторно</SubmitButton>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      {can.record && !cancelled && balance > 0 && (
        <details className="border-t border-border-light pt-3" open>
          {/* Stays open after saving, so the confirmation message remains visible. */}
          <summary className="font-semibold text-sm cursor-pointer">Добавить оплату</summary>
          <ActionForm action={recordPaymentAction} resetOnSuccess className="grid grid-cols-2 gap-2 mt-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            <Field id="pay-amount" label="Сумма, ₸">
              <input id="pay-amount" name="amount" type="number" min={1} max={balance} step={1} required defaultValue={balance} className={inputClass} />
            </Field>
            <Field id="pay-method" label="Способ">
              <select id="pay-method" name="method" defaultValue="KASPI" className={inputClass}>
                {methodOptions}
              </select>
            </Field>
            <Field id="pay-status" label="Статус">
              <select id="pay-status" name="status" defaultValue="PAID" className={inputClass}>
                <option value="PAID">Деньги получены</option>
                <option value="PENDING">Ожидаем оплату</option>
              </select>
            </Field>
            <Field id="pay-date" label="Дата оплаты">
              <input id="pay-date" name="paidAt" type="datetime-local" className={inputClass} />
            </Field>
            <Field id="pay-ref" label="Номер операции / чека">
              <input id="pay-ref" name="reference" maxLength={200} className={inputClass} />
            </Field>
            <Field id="pay-proof" label="Ссылка на подтверждение">
              <input id="pay-proof" name="proofUrl" type="url" maxLength={1000} placeholder="https://…" className={inputClass} />
            </Field>
            <div className="col-span-2">
              <Field id="pay-note" label="Комментарий">
                <input id="pay-note" name="note" maxLength={1000} className={inputClass} />
              </Field>
            </div>
            <div className="col-span-2">
              <SubmitButton>Провести</SubmitButton>
            </div>
          </ActionForm>
        </details>
      )}

      {can.adjust && booking.paidAmount > 0 && (
        <details className="border-t border-border-light pt-3">
          <summary className="font-semibold text-sm cursor-pointer">Возврат клиенту</summary>
          <ActionForm action={refundAction} resetOnSuccess className="grid grid-cols-2 gap-2 mt-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            <Field id="ref-amount" label={`Сумма, ₸ (не больше ${booking.paidAmount})`}>
              <input
                id="ref-amount"
                name="amount"
                type="number"
                min={1}
                max={booking.paidAmount}
                step={1}
                required
                defaultValue={booking.refundAmount ?? booking.paidAmount}
                className={inputClass}
              />
            </Field>
            <Field id="ref-method" label="Способ">
              <select id="ref-method" name="method" defaultValue="KASPI" className={inputClass}>
                {methodOptions}
              </select>
            </Field>
            <Field id="ref-ref" label="Номер операции">
              <input id="ref-ref" name="reference" maxLength={200} className={inputClass} />
            </Field>
            <Field id="ref-note" label="Причина *">
              <input id="ref-note" name="note" required minLength={3} maxLength={1000} className={inputClass} />
            </Field>
            <div className="col-span-2">
              <SubmitButton variant="danger" confirm="Провести возврат? Операция попадёт в финансовый журнал; исправить её можно только сторно.">Провести возврат</SubmitButton>
            </div>
          </ActionForm>
        </details>
      )}

      {can.record && !cancelled && (
        <details className="border-t border-border-light pt-3" open={balance > 0}>
          <summary className="font-semibold text-sm cursor-pointer">Ссылка на оплату (Kaspi)</summary>
          {booking.paymentLinkUrl && (
            <p className="text-xs mt-2 break-all">
              Текущая:{' '}
              <a href={booking.paymentLinkUrl} target="_blank" rel="noopener noreferrer" className="text-orange-accent hover:underline">
                {booking.paymentLinkUrl}
              </a>
            </p>
          )}
          <ActionForm action={paymentLinkAction} className="space-y-2 mt-2">
            <input type="hidden" name="bookingId" value={booking.id} />
            <label htmlFor="link-url" className="sr-only">
              Ссылка на оплату
            </label>
            <input id="link-url" name="url" type="url" required maxLength={1000} placeholder="https://kaspi.kz/pay/…" defaultValue={booking.paymentLinkUrl ?? ''} className={inputClass} />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="notify" defaultChecked={hasClientEmail} disabled={!hasClientEmail} />
              {hasClientEmail ? 'Отправить клиенту письмо со ссылкой' : 'У клиента нет email — отправьте ссылку в WhatsApp'}
            </label>
            <SubmitButton variant="secondary">Сохранить ссылку</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
