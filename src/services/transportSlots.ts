import { supabase } from '../lib/env';
import { listAdminSettings } from './adminOperations';

export type TransportSlotRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  driverName: string;
  contactNumber: string;
  status: 'available' | 'booked' | 'unavailable';
  capacity: number;
  capacityUnit?: string;
  reservedCount: number;
};

export type TransportSlotInput = {
  startsAt: string;
  endsAt: string;
  driverName: string;
  contactNumber: string;
  capacity: number;
  capacityUnit?: string;
};

export type BulkTransportSlotInput = {
  startDate: string;
  endDate: string;
  marketOpen: string;
  marketClose: string;
  slotLengthMinutes: number;
  driverName: string;
  contactNumber: string;
  capacity: number;
  capacityUnit?: string;
};

export type TransportScheduleDefaults = {
  capacity: number;
  publishDaysAhead: number;
  marketOpen: string;
  marketClose: string;
  slotLengthMinutes: number;
};

const demoSlotsKey = 'kirana-demo-transport-slots';
const demoAuditKey = 'kirana-demo-transport-audit';

export async function getTransportScheduleDefaults(): Promise<TransportScheduleDefaults> {
  const defaults: TransportScheduleDefaults = {
    capacity: 1,
    publishDaysAhead: 3,
    marketOpen: '10:00',
    marketClose: '18:00',
    slotLengthMinutes: 60,
  };
  if (!supabase) {
    const saved = new Map((await listAdminSettings()).map(({ key, value }) => [key, value]));
    const config = {
      capacity: Number(saved.get('slot_default_capacity') ?? defaults.capacity),
      publishDaysAhead: Number(saved.get('slot_publish_days_ahead') ?? defaults.publishDaysAhead),
      marketOpen: String(saved.get('market_open_time') ?? defaults.marketOpen),
      marketClose: String(saved.get('market_close_time') ?? defaults.marketClose),
      slotLengthMinutes: Number(saved.get('slot_length_minutes') ?? defaults.slotLengthMinutes),
    };
    if (
      !Number.isInteger(config.capacity) ||
      config.capacity < 1 ||
      !Number.isInteger(config.publishDaysAhead) ||
      config.publishDaysAhead < 0 ||
      config.publishDaysAhead > 30 ||
      !Number.isInteger(config.slotLengthMinutes) ||
      config.slotLengthMinutes < 15 ||
      config.slotLengthMinutes > 720 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.marketOpen) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.marketClose) ||
      config.marketOpen >= config.marketClose
    ) {
      throw new Error('Demo transport schedule settings are not configured correctly.');
    }
    return config;
  }
  const keys = [
    'slot_default_capacity',
    'slot_publish_days_ahead',
    'market_open_time',
    'market_close_time',
    'slot_length_minutes',
  ];
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys);
  if (error) throw error;
  const settings = new Map(data.map((setting) => [setting.key, setting.value]));
  const capacity = Number(settings.get('slot_default_capacity') ?? defaults.capacity);
  const days = Number(settings.get('slot_publish_days_ahead') ?? defaults.publishDaysAhead);
  const slotLength = Number(settings.get('slot_length_minutes') ?? defaults.slotLengthMinutes);
  const marketOpen = settings.get('market_open_time');
  const marketClose = settings.get('market_close_time');
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    !Number.isInteger(days) ||
    days < 0 ||
    days > 30 ||
    !Number.isInteger(slotLength) ||
    slotLength < 15 ||
    slotLength > 720
  ) {
    throw new Error('Transport schedule defaults are not configured correctly.');
  }
  return {
    capacity,
    publishDaysAhead: days,
    marketOpen: typeof marketOpen === 'string' ? marketOpen : defaults.marketOpen,
    marketClose: typeof marketClose === 'string' ? marketClose : defaults.marketClose,
    slotLengthMinutes: slotLength,
  };
}

function readDemoSlots(): TransportSlotRecord[] {
  const saved = localStorage.getItem(demoSlotsKey);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new Error('Saved demo transport slots are invalid. Clear the kirana-demo-transport-slots browser storage key.');
  }
  return (parsed as TransportSlotRecord[]).map((slot) => ({
    ...slot,
    capacityUnit: slot.capacityUnit ?? 'orders',
  }));
}

function writeDemoSlots(slots: TransportSlotRecord[]) {
  localStorage.setItem(demoSlotsKey, JSON.stringify(slots));
}

function recordDemoAudit(actorId: string, action: string, details: Record<string, unknown>) {
  const saved = localStorage.getItem(demoAuditKey);
  const parsed: unknown = saved ? JSON.parse(saved) : [];
  if (!Array.isArray(parsed)) throw new Error('Saved demo transport audit log is invalid.');
  localStorage.setItem(
    demoAuditKey,
    JSON.stringify([{ actorId, action, details, createdAt: new Date().toISOString() }, ...parsed]),
  );
}

function validateSlotInput(input: TransportSlotInput, maxDaysAhead?: number) {
  const startsAt = Date.parse(input.startsAt);
  const endsAt = Date.parse(input.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt <= Date.now() || endsAt <= startsAt) {
    throw new Error('Choose a valid future slot with an end time after its start.');
  }
  if (maxDaysAhead !== undefined) {
    const publishLimit = new Date();
    publishLimit.setDate(publishLimit.getDate() + maxDaysAhead);
    publishLimit.setHours(23, 59, 59, 999);
    if (startsAt > publishLimit.getTime()) throw new Error(`Choose a slot within the next ${maxDaysAhead} days.`);
  }
  if (!input.driverName.trim() || !/^[a-zA-Z\s]+$/.test(input.driverName.trim())) {
    throw new Error('Driver name must contain only alphabets.');
  }
  if (!/^\d{10}$/.test(input.contactNumber.trim())) {
    throw new Error('Contact number must be exactly 10 digits.');
  }
  if (!Number.isFinite(input.capacity) || input.capacity < 1) {
    throw new Error('Order capacity must be at least 1.');
  }
}

export async function listTransportSlots(): Promise<TransportSlotRecord[]> {
  if (!supabase) {
    return readDemoSlots().sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }
  const { data, error } = await supabase
    .from('transport_slots')
    .select('id, starts_at, ends_at, driver_name, contact_number, status, capacity, reserved_count')
    .order('starts_at');
  if (error) throw error;
  return data.map((slot) => ({
    id: slot.id,
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    driverName: slot.driver_name,
    contactNumber: slot.contact_number,
    status: slot.status,
    capacity: slot.capacity,
    capacityUnit: 'orders',
    reservedCount: slot.reserved_count,
  }));
}

export async function createTransportSlot(input: TransportSlotInput, actorId: string) {
  const maxDaysAhead = supabase ? undefined : (await getTransportScheduleDefaults()).publishDaysAhead;
  validateSlotInput(input, maxDaysAhead);
  if (supabase) {
    const { error } = await supabase.rpc('admin_create_transport_slot', {
      starts_at_input: input.startsAt,
      ends_at_input: input.endsAt,
      driver_name_input: input.driverName.trim(),
      contact_number_input: input.contactNumber.trim(),
      capacity_input: Math.round(input.capacity),
    });
    if (error) throw error;
    return;
  }
  const slots = readDemoSlots();
  if (slots.some((slot) => slot.startsAt === input.startsAt && slot.driverName === input.driverName.trim())) {
    throw new Error('This driver already has a slot at that time.');
  }
  slots.push({
    id: crypto.randomUUID(),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    driverName: input.driverName.trim(),
    contactNumber: input.contactNumber.trim(),
    status: 'available',
    capacity: input.capacity,
    capacityUnit: input.capacityUnit?.trim() || 'orders',
    reservedCount: 0,
  });
  writeDemoSlots(slots);
  recordDemoAudit(actorId, 'transport_slot_created', {
    startsAt: input.startsAt,
    capacity: input.capacity,
    capacityUnit: input.capacityUnit,
  });
}

export async function bulkCreateTransportSlots(input: BulkTransportSlotInput, actorId: string) {
  if (!supabase) {
    const publishDaysAhead = (await getTransportScheduleDefaults()).publishDaysAhead;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const start = new Date(`${input.startDate}T00:00:00`);
    const end = new Date(`${input.endDate}T00:00:00`);
    const isValidDate = (value: string, date: Date) => {
      if (!datePattern.test(value) || !Number.isFinite(date.getTime())) return false;
      const [year, month, day] = value.split('-').map(Number);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastPublishDate = new Date(today);
    lastPublishDate.setDate(lastPublishDate.getDate() + publishDaysAhead);
    if (!isValidDate(input.startDate, start) || !isValidDate(input.endDate, end) || start < today || end < start || end > lastPublishDate) {
      throw new Error(`Choose dates within the next ${publishDaysAhead} days.`);
    }
    if (!Number.isInteger(input.slotLengthMinutes) || input.slotLengthMinutes < 15 || input.slotLengthMinutes > 720) {
      throw new Error('Slot length must be between 15 and 720 minutes.');
    }
    if (!timePattern.test(input.marketOpen) || !timePattern.test(input.marketClose) || input.marketClose <= input.marketOpen) {
      throw new Error('Enter valid market opening and closing times.');
    }
    validateDriverAndCapacity(input);
    const nextSlots = readDemoSlots();
    let createdCount = 0;
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const [openHour, openMinute] = input.marketOpen.split(':').map(Number);
      const [closeHour, closeMinute] = input.marketClose.split(':').map(Number);
      const opensAt = new Date(`${date}T${input.marketOpen}:00`);
      const closesAt = new Date(`${date}T${input.marketClose}:00`);
      opensAt.setHours(openHour, openMinute, 0, 0);
      closesAt.setHours(closeHour, closeMinute, 0, 0);
      for (let slotStart = opensAt; slotStart.getTime() + input.slotLengthMinutes * 60_000 <= closesAt.getTime();) {
        const slotEnd = new Date(slotStart.getTime() + input.slotLengthMinutes * 60_000);
        const startsAt = slotStart.toISOString();
        if (slotStart > new Date() && !nextSlots.some((slot) => slot.startsAt === startsAt && slot.driverName === input.driverName.trim())) {
          nextSlots.push({
            id: crypto.randomUUID(),
            startsAt,
            endsAt: slotEnd.toISOString(),
            driverName: input.driverName.trim(),
            contactNumber: input.contactNumber.trim(),
            status: 'available',
            capacity: input.capacity,
            capacityUnit: input.capacityUnit?.trim() || 'orders',
            reservedCount: 0,
          });
          createdCount += 1;
        }
        slotStart = slotEnd;
      }
    }
    if (!createdCount) throw new Error('No new future transport slots were created.');
    writeDemoSlots(nextSlots);
    recordDemoAudit(actorId, 'transport_slots_bulk_created', {
      startDate: input.startDate,
      endDate: input.endDate,
      createdCount,
    });
    return createdCount;
  }

  const { data, error } = await supabase.rpc('admin_bulk_create_transport_slots', {
    date_start_input: input.startDate,
    date_end_input: input.endDate,
    market_open_input: input.marketOpen,
    market_close_input: input.marketClose,
    slot_length_minutes_input: input.slotLengthMinutes,
    driver_name_input: input.driverName.trim(),
    contact_number_input: input.contactNumber.trim(),
    capacity_input: Math.round(input.capacity),
  });
  if (error) throw error;
  return data;
}

export async function updateTransportSlot(slotId: string, input: TransportSlotInput, actorId: string) {
  const maxDaysAhead = supabase ? undefined : (await getTransportScheduleDefaults()).publishDaysAhead;
  validateSlotInput(input, maxDaysAhead);
  if (supabase) {
    const { error } = await supabase.rpc('admin_update_transport_slot', {
      slot_id_input: slotId,
      starts_at_input: input.startsAt,
      ends_at_input: input.endsAt,
      driver_name_input: input.driverName.trim(),
      contact_number_input: input.contactNumber.trim(),
      capacity_input: Math.round(input.capacity),
    });
    if (error) throw error;
    return;
  }
  const slots = readDemoSlots();
  const existing = slots.find((slot) => slot.id === slotId);
  if (!existing) throw new Error('Transport slot not found.');
  if (input.capacity < existing.reservedCount) throw new Error('Capacity cannot be lower than existing bookings.');
  if (
    slots.some(
      (slot) => slot.id !== slotId && slot.startsAt === input.startsAt && slot.driverName === input.driverName.trim(),
    )
  ) {
    throw new Error('This driver already has a slot at that time.');
  }
  const updated: TransportSlotRecord[] = slots.map((slot) =>
    slot.id === slotId
      ? {
          ...slot,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          driverName: input.driverName.trim(),
          contactNumber: input.contactNumber.trim(),
          capacity: input.capacity,
          capacityUnit: input.capacityUnit?.trim() || slot.capacityUnit || 'orders',
          status:
            slot.status === 'unavailable'
              ? slot.status
              : existing.reservedCount >= input.capacity
                ? 'booked'
                : 'available',
        }
      : slot,
  );
  writeDemoSlots(updated);
  recordDemoAudit(actorId, 'transport_slot_updated', {
    slotId,
    startsAt: input.startsAt,
    capacity: input.capacity,
    capacityUnit: input.capacityUnit,
  });
}

function validateDriverAndCapacity(input: Pick<TransportSlotInput, 'driverName' | 'contactNumber' | 'capacity'>) {
  if (!input.driverName.trim() || !/^[a-zA-Z\s]+$/.test(input.driverName.trim())) {
    throw new Error('Driver name must contain only alphabets.');
  }
  if (!/^\d{10}$/.test(input.contactNumber.trim())) {
    throw new Error('Contact number must be exactly 10 digits.');
  }
  if (!Number.isFinite(input.capacity) || input.capacity < 1) {
    throw new Error('Order capacity must be at least 1.');
  }
}

export async function setTransportSlotUnavailable(slotId: string, unavailable: boolean, actorId: string) {
  if (supabase) {
    const { error } = await supabase.rpc('admin_set_transport_slot_unavailable', {
      slot_id_input: slotId,
      unavailable_input: unavailable,
    });
    if (error) throw error;
    return;
  }
  const slots = readDemoSlots();
  const existing = slots.find((slot) => slot.id === slotId);
  if (!existing) throw new Error('Transport slot not found.');
  if (unavailable && existing.reservedCount > 0) throw new Error('A slot with existing bookings cannot be marked unavailable.');
  if (!unavailable && Date.parse(existing.startsAt) <= Date.now()) throw new Error('A past or ongoing slot cannot be made available.');
  writeDemoSlots(
    slots.map((slot) =>
      slot.id === slotId
        ? {
            ...slot,
            status: unavailable ? 'unavailable' : slot.reservedCount >= slot.capacity ? 'booked' : 'available',
          }
        : slot,
    ),
  );
  recordDemoAudit(actorId, unavailable ? 'transport_slot_unavailable' : 'transport_slot_published', { slotId });
}

export function listAvailableDemoTransportSlots() {
  return readDemoSlots()
    .filter((slot) => slot.status === 'available' && slot.reservedCount < slot.capacity && Date.parse(slot.startsAt) > Date.now())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
}

export function reserveDemoTransportSlot(slotId: string) {
  const slots = readDemoSlots();
  const slot = slots.find((candidate) => candidate.id === slotId);
  if (!slot || slot.status !== 'available' || slot.reservedCount >= slot.capacity || Date.parse(slot.startsAt) <= Date.now()) {
    throw new Error('The selected truck slot is no longer available.');
  }
  const updated = { ...slot, reservedCount: slot.reservedCount + 1 };
  updated.status = updated.reservedCount >= updated.capacity ? 'booked' : 'available';
  writeDemoSlots(slots.map((candidate) => (candidate.id === slotId ? updated : candidate)));
  return updated;
}

export function releaseDemoTransportSlot(slotId: string) {
  const slots = readDemoSlots();
  const slot = slots.find((candidate) => candidate.id === slotId);
  if (!slot) return;
  const reservedCount = Math.max(0, slot.reservedCount - 1);
  writeDemoSlots(
    slots.map((candidate) =>
      candidate.id === slotId
        ? {
            ...candidate,
            reservedCount,
            status:
              candidate.status === 'unavailable'
                ? 'unavailable'
                : reservedCount >= candidate.capacity
                  ? 'booked'
                  : 'available',
          }
        : candidate,
    ),
  );
}
