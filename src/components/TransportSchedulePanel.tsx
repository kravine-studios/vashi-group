import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil, Plus, RefreshCw, Truck } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  createTransportSlot,
  getTransportScheduleDefaults,
  listTransportSlots,
  setTransportSlotUnavailable,
  updateTransportSlot,
  type TransportSlotInput,
  type TransportSlotRecord,
} from '../services/transportSlots';

type SlotForm = {
  availableDate: string;
  availableUntil: string;
  driverName: string;
  contactNumber: string;
  orderCapacity: string;
  capacityUnit: string;
  deliveryLocation: string;
};

const emptySlotForm: SlotForm = {
  availableDate: dateInputValue(new Date()),
  availableUntil: '17:00',
  driverName: '',
  contactNumber: '',
  orderCapacity: '1',
  capacityUnit: 'orders',
  deliveryLocation: '',
};

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function TransportSchedulePanel({ onCountChange, sectionId }: { onCountChange: (count: number) => void; sectionId?: string }) {
  const { account } = useAuth();
  const [slots, setSlots] = useState<TransportSlotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<SlotForm>(emptySlotForm);
  const [defaultCapacity, setDefaultCapacity] = useState(1);
  const [marketOpen, setMarketOpen] = useState('10:00');
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
        setSlotForm((current) => ({ ...current, orderCapacity: String(defaults.capacity) }));
        setMarketOpen(defaults.marketOpen);
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
      if (!slotForm.availableDate) throw new Error('Select an available date.');
      if (!slotForm.availableUntil) throw new Error('Choose the time the driver is available until.');
      const startsAt = new Date(`${slotForm.availableDate}T${marketOpen}`);
      const endsAt = new Date(`${slotForm.availableDate}T${slotForm.availableUntil}`);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        throw new Error('Choose a valid available date and an end time after the start time.');
      }
      const capacity = Number(slotForm.orderCapacity);
      if (!Number.isFinite(capacity) || capacity < 1 || capacity > 1000) {
        throw new Error('Order capacity must be at least 1 and up to 1000.');
      }
      const input: TransportSlotInput = {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        driverName: slotForm.driverName,
        contactNumber: slotForm.contactNumber,
        capacity,
      };
      if (editingSlotId) {
        await updateTransportSlot(editingSlotId, input, account.id);
      } else {
        await createTransportSlot(input, account.id);
      }
      setEditingSlotId(null);
      setSlotForm({ ...emptySlotForm, orderCapacity: String(defaultCapacity) });
    }, editingSlotId ? 'Transport slot updated.' : 'Transport slot published.');
  };

  const editSlot = (slot: TransportSlotRecord) => {
    setEditingSlotId(slot.id);
    const date = slot.startsAt.slice(0, 10);
    setSlotForm({
      availableDate: date,
      availableUntil: new Date(slot.endsAt).toTimeString().slice(0, 5),
      driverName: slot.driverName,
      contactNumber: slot.contactNumber,
      orderCapacity: String(slot.capacity),
      capacityUnit: 'orders',
      deliveryLocation: '',
    });
    setError(null);
    setNotice(null);
  };

  return (
    <section id={sectionId} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card md:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Transport operations</p>
          <h2 className="mt-1 text-xl font-bold">Slot schedule</h2>
          <p className="mt-1 text-sm text-slate-500">Publish a single truck slot for the market day.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void loadSlots()} disabled={loading || saving}>
          <RefreshCw size={15} className="mr-2" /> Refresh
        </Button>
      </header>

      {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-5">
        <form onSubmit={submitSingleSlot} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 font-semibold"><Plus size={17} /> {editingSlotId ? 'Edit truck slot' : 'Create one truck slot'}</div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Available date
              <input required type="date" value={slotForm.availableDate} onChange={(event) => setSlotForm((current) => ({ ...current, availableDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Available until
              <input required type="time" value={slotForm.availableUntil} onChange={(event) => setSlotForm((current) => ({ ...current, availableUntil: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Driver name
              <input required maxLength={100} value={slotForm.driverName} onChange={(event) => setSlotForm((current) => ({ ...current, driverName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Contact number
              <input required value={slotForm.contactNumber} onChange={(event) => setSlotForm((current) => ({ ...current, contactNumber: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <label className="block text-sm font-medium text-slate-700">
              Order capacity
              <input required type="number" min="1" max="1000" step="1" value={slotForm.orderCapacity} onChange={(event) => setSlotForm((current) => ({ ...current, orderCapacity: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Unit
              <select value={slotForm.capacityUnit} onChange={(event) => setSlotForm((current) => ({ ...current, capacityUnit: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
                <option value="orders">Orders</option>
                <option value="bags">Bags</option>
                <option value="crates">Crates</option>
                <option value="boxes">Boxes</option>
                <option value="kg">Kg</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Delivery location
            <input required value={slotForm.deliveryLocation} onChange={(event) => setSlotForm((current) => ({ ...current, deliveryLocation: event.target.value }))} placeholder="e.g. Vashi APMC gate 3, north side" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingSlotId ? 'Save changes' : 'Publish truck slot'}</Button>
            {editingSlotId ? <Button variant="secondary" onClick={() => { setEditingSlotId(null); setSlotForm({ ...emptySlotForm, orderCapacity: String(defaultCapacity) }); }}>Cancel</Button> : null}
          </div>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 font-semibold">Published slots <span className="text-sm font-normal text-slate-500">({slots.length})</span></h3>
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
