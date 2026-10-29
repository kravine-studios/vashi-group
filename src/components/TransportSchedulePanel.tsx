import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarClock, Pencil, Plus, RefreshCw, Truck } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  bulkCreateTransportSlots,
  createTransportSlot,
  getTransportScheduleDefaults,
  listTransportSlots,
  setTransportSlotUnavailable,
  updateTransportSlot,
  type TransportSlotInput,
  type TransportSlotRecord,
} from '../services/transportSlots';

type SlotForm = {
  startsAt: string;
  endsAt: string;
  driverName: string;
  contactNumber: string;
  capacity: string;
};

const emptySlotForm: SlotForm = {
  startsAt: '',
  endsAt: '',
  driverName: '',
  contactNumber: '',
  capacity: '1',
};

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function TransportSchedulePanel({ onCountChange }: { onCountChange: (count: number) => void }) {
  const { account } = useAuth();
  const [slots, setSlots] = useState<TransportSlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<SlotForm>(emptySlotForm);
  const [defaultCapacity, setDefaultCapacity] = useState(1);
  const [startDate, setStartDate] = useState(dateInputValue(new Date()));
  const [endDate, setEndDate] = useState(dateInputValue(new Date()));
  const [marketOpen, setMarketOpen] = useState('10:00');
  const [marketClose, setMarketClose] = useState('18:00');
  const [slotLength, setSlotLength] = useState('60');
  const [publishDaysAhead, setPublishDaysAhead] = useState(3);
  const [bulkDriver, setBulkDriver] = useState('');
  const [bulkContact, setBulkContact] = useState('');
  const [bulkCapacity, setBulkCapacity] = useState('1');
  const defaultsLoaded = useRef(false);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loaded, defaults] = await Promise.all([listTransportSlots(), getTransportScheduleDefaults()]);
      const upcoming = loaded.filter((slot) => Date.parse(slot.endsAt) > Date.now());
      setSlots(upcoming);
      if (!defaultsLoaded.current) {
        setDefaultCapacity(defaults.capacity);
        setSlotForm((current) => ({ ...current, capacity: String(defaults.capacity) }));
        setBulkCapacity(String(defaults.capacity));
        setMarketOpen(defaults.marketOpen);
        setMarketClose(defaults.marketClose);
        setSlotLength(String(defaults.slotLengthMinutes));
        setPublishDaysAhead(defaults.publishDaysAhead);
        defaultsLoaded.current = true;
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load transport slots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    onCountChange(slots.filter((slot) => slot.status === 'available' && Date.parse(slot.startsAt) > Date.now()).length);
  }, [onCountChange, slots]);

  const runSlotAction = async (action: () => Promise<void | string>, successMessage: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const actionMessage = await action();
      setNotice(typeof actionMessage === 'string' ? actionMessage : successMessage);
      await loadSlots();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update transport slots.');
    } finally {
      setSaving(false);
    }
  };

  const submitSingleSlot = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    void runSlotAction(async () => {
      const startsAt = new Date(slotForm.startsAt);
      const endsAt = new Date(slotForm.endsAt);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
        throw new Error('Enter valid start and end times for the slot.');
      }
      const input: TransportSlotInput = {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        driverName: slotForm.driverName,
        contactNumber: slotForm.contactNumber,
        capacity: Number(slotForm.capacity),
      };
      if (editingSlotId) {
        await updateTransportSlot(editingSlotId, input, account.id);
      } else {
        await createTransportSlot(input, account.id);
      }
      setEditingSlotId(null);
      setSlotForm({ ...emptySlotForm, capacity: String(defaultCapacity) });
    }, editingSlotId ? 'Transport slot updated.' : 'Transport slot published.');
  };

  const submitBulkSlots = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!account) return;
    void runSlotAction(async () => {
      const count = await bulkCreateTransportSlots({
        startDate,
        endDate,
        marketOpen,
        marketClose,
        slotLengthMinutes: Number(slotLength),
        driverName: bulkDriver,
        contactNumber: bulkContact,
        capacity: Number(bulkCapacity),
      }, account.id);
      return `${count} transport slots created.`;
    }, 'Bulk schedule created.');
  };

  const editSlot = (slot: TransportSlotRecord) => {
    setEditingSlotId(slot.id);
    setSlotForm({
      startsAt: toLocalDateTime(slot.startsAt),
      endsAt: toLocalDateTime(slot.endsAt),
      driverName: slot.driverName,
      contactNumber: slot.contactNumber,
      capacity: String(slot.capacity),
    });
    setError(null);
    setNotice(null);
  };

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Transport operations</p>
          <h2 className="mt-1 text-xl font-bold">Slot schedule</h2>
          <p className="mt-1 text-sm text-slate-500">Publish individual or repeating market-hour slots up to {publishDaysAhead} days ahead.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadSlots()} disabled={loading || saving}>
          <RefreshCw size={15} className="mr-2" /> Refresh
        </Button>
      </header>

      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={submitSingleSlot} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 font-semibold"><Plus size={17} /> {editingSlotId ? 'Edit slot' : 'Create one slot'}</div>
          <label className="block text-sm font-medium text-slate-700">
            Starts at
            <input required type="datetime-local" value={slotForm.startsAt} onChange={(event) => setSlotForm((current) => ({ ...current, startsAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Ends at
            <input required type="datetime-local" value={slotForm.endsAt} onChange={(event) => setSlotForm((current) => ({ ...current, endsAt: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Truck / driver name
              <input required maxLength={100} value={slotForm.driverName} onChange={(event) => setSlotForm((current) => ({ ...current, driverName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Contact number
              <input required value={slotForm.contactNumber} onChange={(event) => setSlotForm((current) => ({ ...current, contactNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Order capacity
            <input required type="number" min="1" max="100" step="1" value={slotForm.capacity} onChange={(event) => setSlotForm((current) => ({ ...current, capacity: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingSlotId ? 'Save changes' : 'Publish slot'}</Button>
            {editingSlotId ? <Button variant="secondary" onClick={() => { setEditingSlotId(null); setSlotForm({ ...emptySlotForm, capacity: String(defaultCapacity) }); }}>Cancel</Button> : null}
          </div>
        </form>

        <form onSubmit={submitBulkSlots} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 font-semibold"><CalendarClock size={17} /> Bulk-create slots</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">First date
              <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Last date
              <input required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Market opens
              <input required type="time" value={marketOpen} onChange={(event) => setMarketOpen(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Market closes
              <input required type="time" value={marketClose} onChange={(event) => setMarketClose(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Slot length (minutes)
              <input required type="number" min="15" max="720" step="15" value={slotLength} onChange={(event) => setSlotLength(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Orders per slot
              <input required type="number" min="1" max="100" step="1" value={bulkCapacity} onChange={(event) => setBulkCapacity(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Truck / driver name
              <input required maxLength={100} value={bulkDriver} onChange={(event) => setBulkDriver(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Contact number
              <input required value={bulkContact} onChange={(event) => setBulkContact(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create schedule'}</Button>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-semibold">Upcoming slots <span className="text-sm font-normal text-slate-500">({slots.length})</span></h3>
        {loading ? <p className="py-5 text-center text-sm text-slate-500">Loading schedule…</p> : null}
        {!loading && !slots.length ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No upcoming slots published.</p> : null}
        {!loading && slots.length ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {slots.map((slot) => (
              <article key={slot.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Truck size={18} className="mt-1 shrink-0 text-emerald-700" />
                  <div>
                    <p className="font-semibold">{new Date(slot.startsAt).toLocaleString('en-IN')} – {new Date(slot.endsAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
                    <p className="text-sm text-slate-600">{slot.driverName} · <a href={`tel:${slot.contactNumber}`} className="hover:underline">{slot.contactNumber}</a></p>
                    <p className="mt-1 text-xs text-slate-500">{slot.reservedCount} of {slot.capacity} orders reserved</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={slot.status === 'available' ? 'success' : slot.status === 'booked' ? 'warning' : 'danger'}>{slot.status}</Badge>
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => editSlot(slot)}><Pencil size={14} className="mr-1" /> Edit</Button>
                  {slot.status !== 'booked' ? (
                    <Button
                      size="sm"
                      variant={slot.status === 'unavailable' ? 'secondary' : 'danger'}
                      disabled={saving}
                      onClick={() => {
                        if (!account) return;
                        void runSlotAction(
                          () => setTransportSlotUnavailable(slot.id, slot.status !== 'unavailable', account.id),
                          slot.status === 'unavailable' ? 'Slot made available.' : 'Slot marked unavailable.',
                        );
                      }}
                    >
                      {slot.status === 'unavailable' ? 'Make available' : 'Mark unavailable'}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
