import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Banknote,
  CalendarDays,
  Check,
  CreditCard,
  DoorOpen,
  ImagePlus,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  Save,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { demoPhotos, demoProperties, demoProperty, demoReservations } from './data/demo';
import { hasSupabaseConfig, supabase } from './lib/supabase';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'glawcksilva8@gmail.com';
const localAdminPassword = import.meta.env.VITE_LOCAL_ADMIN_PASSWORD || '';
const canUseLocalAdmin = import.meta.env.DEV && Boolean(localAdminPassword);
const fallbackOwnerWhatsapp = import.meta.env.VITE_OWNER_WHATSAPP || '43998108328';
const paymentLabels = {
  pix: 'Pix',
  card: 'Cartão',
  cash: 'Dinheiro',
  check: 'Cheque',
};

const emptyProperty = {
  name: '',
  city: '',
  headline: '',
  description: '',
  daily_rate: 0,
  cleaning_fee: 0,
  max_guests: 1,
  bedrooms: 1,
  bathrooms: 1,
  owner_whatsapp: fallbackOwnerWhatsapp,
  maps_url: '',
  theme_color: '#2563eb',
  rules: [],
  amenities: [],
};

function toDate(value) {
  return value ? parseISO(value) : null;
}

function dateKey(date) {
  return format(date, 'yyyy-MM-dd');
}

function getBookedDates(reservations) {
  const booked = new Set();
  reservations
    .filter((reservation) => ['confirmed', 'blocked'].includes(reservation.status))
    .forEach((reservation) => {
      const start = toDate(reservation.check_in);
      const end = addDays(toDate(reservation.check_out), -1);
      if (!start || !end || isBefore(end, start)) return;
      eachDayOfInterval({ start, end }).forEach((day) => booked.add(dateKey(day)));
    });
  return booked;
}

function hasConflict(reservations, checkIn, checkOut) {
  if (!checkIn || !checkOut) return false;
  const selectedStart = toDate(checkIn);
  const selectedEnd = addDays(toDate(checkOut), -1);
  if (!selectedStart || !selectedEnd) return false;

  return reservations
    .filter((reservation) => ['confirmed', 'blocked'].includes(reservation.status))
    .some((reservation) => {
      const reservedStart = toDate(reservation.check_in);
      const reservedEnd = addDays(toDate(reservation.check_out), -1);
      return (
        isWithinInterval(selectedStart, { start: reservedStart, end: reservedEnd }) ||
        isWithinInterval(selectedEnd, { start: reservedStart, end: reservedEnd }) ||
        isWithinInterval(reservedStart, { start: selectedStart, end: selectedEnd })
      );
    });
}

function buildCalendarDays(month) {
  const firstVisible = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const lastMonthDay = endOfMonth(month);
  return Array.from({ length: 42 }, (_, index) => addDays(firstVisible, index)).filter((day) =>
    isBefore(day, addDays(lastMonthDay, 14)),
  );
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeWhatsAppPhone(phone) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function normalizeHexColor(color) {
  return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#2563eb';
}

function mixHex(color, target, amount) {
  const source = normalizeHexColor(color).slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
  const goal = normalizeHexColor(target).slice(1).match(/.{2}/g).map((part) => parseInt(part, 16));
  const mixed = source.map((value, index) => Math.round(value + (goal[index] - value) * amount));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function buildThemeStyle(color) {
  const accent = normalizeHexColor(color);
  return {
    '--property-accent': accent,
    '--property-accent-light': mixHex(accent, '#ffffff', 0.38),
    '--property-accent-dark': mixHex(accent, '#020617', 0.34),
  };
}

function buildReservationMessage({ property, reservation, nights }) {
  return [
    `Nova solicitação de reserva - ${property.name}`,
    '',
    `Nome: ${reservation.guest_name}`,
    `Telefone: ${reservation.guest_phone}`,
    `Email: ${reservation.guest_email}`,
    reservation.guest_document ? `Documento: ${reservation.guest_document}` : null,
    `Check-in: ${reservation.check_in}`,
    `Check-out: ${reservation.check_out}`,
    `Noites: ${nights}`,
    `Hóspedes: ${reservation.guests}`,
    `Pagamento: ${paymentLabels[reservation.payment_method] || 'A combinar'}`,
    `Total estimado: ${currency.format(reservation.total_amount || 0)}`,
    reservation.payment_url ? `Link de pagamento: ${reservation.payment_url}` : null,
    reservation.notes ? `Observações: ${reservation.notes}` : null,
    '',
    `Código da reserva: ${reservation.id}`,
    'Aguardando confirmação do proprietário.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildWhatsAppUrl(phone, message) {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return '';
  return `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

function buildGuestConfirmationMessage(property, reservation) {
  const paymentNotice = ['pix', 'card'].includes(reservation.payment_method)
    ? 'Pix e cartão estão em manutenção no momento. Vamos combinar o pagamento por aqui.'
    : `Forma de pagamento combinada: ${paymentLabels[reservation.payment_method] || 'a combinar'}.`;

  return [
    `Olá, ${reservation.guest_name}.`,
    `Sua reserva em ${property.name} foi confirmada.`,
    `Check-in: ${reservation.check_in}`,
    `Check-out: ${reservation.check_out}`,
    `Hóspedes: ${reservation.guests}`,
    `Total estimado: ${currency.format(reservation.total_amount || 0)}`,
    paymentNotice,
  ].join('\n');
}

function buildMapsUrl(property) {
  if (property.maps_url) return property.maps_url;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.city)}`;
}

function isAdminEmail(email) {
  return String(email || '').toLowerCase() === adminEmail.toLowerCase();
}

function Button({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'btn-primary-theme',
    secondary: 'btn-secondary-theme',
    ghost:
      'bg-white/85 text-ink shadow-[0_10px_24px_rgba(255,255,255,0.18)] backdrop-blur hover:bg-white',
    outline:
      'border border-blue-200 bg-gradient-to-r from-white to-blue-50 text-ink shadow-sm hover:border-blue-300 hover:from-blue-50 hover:to-white',
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-ink shadow-sm transition placeholder:text-ink/40"
      {...props}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      className="min-h-24 rounded-md border border-ink/15 bg-white px-3 py-2 text-ink shadow-sm transition placeholder:text-ink/40"
      {...props}
    />
  );
}

function SelectInput({ children, ...props }) {
  return (
    <select
      className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-ink shadow-sm transition"
      {...props}
    >
      {children}
    </select>
  );
}

export default function App() {
  const [properties, setProperties] = useState(demoProperties);
  const [selectedPropertyId, setSelectedPropertyId] = useState(demoProperty.id);
  const [photos, setPhotos] = useState(demoPhotos);
  const [reservations, setReservations] = useState(demoReservations);
  const [cashMovements, setCashMovements] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [month, setMonth] = useState(new Date());
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminSession, setAdminSession] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [propertyTransitionKey, setPropertyTransitionKey] = useState(0);
  const [booking, setBooking] = useState({
    check_in: '',
    check_out: '',
    guests: 2,
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guest_document: '',
    payment_method: 'pix',
    notes: '',
  });

  const property = properties.find((item) => item.id === selectedPropertyId) || properties[0] || demoProperty;
  const propertyPhotos = useMemo(
    () => photos.filter((photo) => photo.property_id === property.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [photos, property.id],
  );
  const propertyReservations = useMemo(
    () => reservations.filter((reservation) => reservation.property_id === property.id),
    [reservations, property.id],
  );
  const propertyCashMovements = useMemo(
    () => cashMovements.filter((movement) => movement.property_id === property.id),
    [cashMovements, property.id],
  );
  const selectedPhotoData = propertyPhotos[selectedPhoto] || propertyPhotos[0] || demoPhotos[0];
  const bookedDates = useMemo(() => getBookedDates(propertyReservations), [propertyReservations]);
  const nights = useMemo(() => {
    if (!booking.check_in || !booking.check_out) return 0;
    return Math.max(0, differenceInCalendarDays(toDate(booking.check_out), toDate(booking.check_in)));
  }, [booking.check_in, booking.check_out]);
  const subtotal = nights * Number(property.daily_rate || 0);
  const total = subtotal + (nights > 0 ? Number(property.cleaning_fee || 0) : 0);
  const reservationConflict = hasConflict(propertyReservations, booking.check_in, booking.check_out);
  const financialSummary = useMemo(() => {
    const received = propertyCashMovements
      .filter((movement) => movement.type === 'income' && movement.status === 'received')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const receivable = propertyReservations
      .filter((reservation) => ['pending', 'confirmed'].includes(reservation.status))
      .filter((reservation) => reservation.payment_status !== 'paid')
      .reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
    return { received, receivable, forecast: received + receivable };
  }, [propertyCashMovements, propertyReservations]);
  const canBook =
    nights > 0 &&
    !reservationConflict &&
    String(booking.guest_name).trim() &&
    String(booking.guest_email).trim() &&
    String(booking.guest_phone).trim() &&
    String(booking.guest_document).trim() &&
    String(booking.notes).trim() &&
    booking.payment_method &&
    Number(booking.guests) > 0 &&
    Number(booking.guests) <= property.max_guests;
  const propertyThemeStyle = useMemo(() => buildThemeStyle(property.theme_color), [property.theme_color]);

  useEffect(() => {
    async function loadData() {
      if (!hasSupabaseConfig) {
        setLoading(false);
        return;
      }

      const [{ data: propertyRows }, { data: photoRows }, { data: reservationRows }, { data: movementRows }] =
        await Promise.all([
          supabase.from('properties').select('*').order('created_at'),
          supabase.from('property_photos').select('*').order('sort_order'),
          supabase.from('reservations').select('*').order('check_in'),
          supabase.from('cash_movements').select('*').order('due_date', { ascending: false }),
        ]);

      if (propertyRows?.length) {
        setProperties(propertyRows);
        setSelectedPropertyId(propertyRows[0].id);
      }
      if (photoRows?.length) setPhotos(photoRows);
      if (reservationRows?.length) setReservations(reservationRows);
      if (movementRows?.length) setCashMovements(movementRows);
      setLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    setSelectedPhoto(0);
    setMessage('');
    setPropertyTransitionKey((current) => current + 1);
    setBooking((current) => ({
      ...current,
      check_in: '',
      check_out: '',
    }));
  }, [property.id]);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session && isAdminEmail(data.session.user.email) ? data.session : null;
      setAdminSession(session);
      setAdminUnlocked(Boolean(session));
      if (data.session && !session) supabase.auth.signOut();
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const adminSession = session && isAdminEmail(session.user.email) ? session : null;
      setAdminSession(adminSession);
      setAdminUnlocked(Boolean(adminSession));
      if (session && !adminSession) supabase.auth.signOut();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function createReservation(event) {
    event.preventDefault();
    if (!canBook) return;

    const reservation = {
      property_id: property.id,
      ...booking,
      guests: Number(booking.guests),
      total_amount: total,
      status: 'pending',
      payment_status: 'pending',
      payment_method: booking.payment_method,
    };

    if (hasSupabaseConfig) {
      const { data, error } = await supabase.from('reservations').insert(reservation).select().single();
      if (error) {
        setMessage('Não foi possível criar a reserva agora. Confira os dados e tente novamente.');
        return;
      }
      setReservations((current) => [...current, data]);
    } else {
      const localReservation = { ...reservation, id: crypto.randomUUID() };
      setReservations((current) => [...current, localReservation]);
    }

    setMessage('Solicitação enviada. Aguarde a confirmação do proprietário pelo WhatsApp.');
    setBooking({
      check_in: '',
      check_out: '',
      guests: 2,
      guest_name: '',
      guest_email: '',
      guest_phone: '',
      guest_document: '',
      payment_method: 'pix',
      notes: '',
    });
  }

  async function createPaymentLink(reservation) {
    if (!hasSupabaseConfig || !['pix', 'card'].includes(reservation.payment_method)) {
      return reservation;
    }

    const { data, error } = await supabase.functions.invoke('create-payment-preference', {
      body: {
        reservationId: reservation.id,
        propertyName: property.name,
        payerEmail: reservation.guest_email,
        amount: Number(reservation.total_amount || 0),
      },
    });

    if (error || !data?.paymentUrl) return reservation;
    return { ...reservation, payment_url: data.paymentUrl };
  }

  async function saveProperty(updated) {
    setProperties((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    if (hasSupabaseConfig) {
      await supabase.from('properties').update(updated).eq('id', updated.id);
    }
    setMessage('Informações da casa atualizadas.');
  }

  function selectProperty(propertyId) {
    if (propertyId === property.id) return;
    setSelectedPropertyId(propertyId);
  }

  async function addProperty(propertyDraft) {
    const propertyPayload = {
      ...emptyProperty,
      ...propertyDraft,
      id: crypto.randomUUID(),
      daily_rate: Number(propertyDraft.daily_rate || 0),
      cleaning_fee: Number(propertyDraft.cleaning_fee || 0),
      max_guests: Number(propertyDraft.max_guests || 1),
      bedrooms: Number(propertyDraft.bedrooms || 1),
      bathrooms: Number(propertyDraft.bathrooms || 1),
      owner_whatsapp: propertyDraft.owner_whatsapp || fallbackOwnerWhatsapp,
      amenities: Array.isArray(propertyDraft.amenities) ? propertyDraft.amenities : [],
      rules: Array.isArray(propertyDraft.rules) ? propertyDraft.rules : [],
    };

    let createdProperty = propertyPayload;
    if (hasSupabaseConfig) {
      const { id, ...insertable } = propertyPayload;
      const { data, error } = await supabase.from('properties').insert(insertable).select().single();
      if (error) {
        setMessage('Não foi possível cadastrar a casa agora.');
        return;
      }
      createdProperty = data;
    }

    setProperties((current) => [...current, createdProperty]);
    setSelectedPropertyId(createdProperty.id);
    setMessage('Casa cadastrada. Agora adicione fotos e ajuste os dados.');
  }

  async function addPhoto(photo) {
    const nextPhoto = {
      id: crypto.randomUUID(),
      property_id: property.id,
      sort_order: propertyPhotos.length + 1,
      ...photo,
    };
    setPhotos((current) => [...current, nextPhoto]);
    if (hasSupabaseConfig) {
      const { id, ...insertable } = nextPhoto;
      await supabase.from('property_photos').insert(insertable);
    }
    setMessage('Foto adicionada a galeria.');
  }

  async function updateReservationStatus(id, status) {
    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === id
          ? {
              ...reservation,
              status,
              payment_status: status === 'confirmed' ? 'paid' : reservation.payment_status,
            }
          : reservation,
      ),
    );

    if (hasSupabaseConfig) {
      const updatePayload = { status };
      if (status === 'confirmed') updatePayload.payment_status = 'paid';

      await supabase
        .from('reservations')
        .update(updatePayload)
        .eq('id', id);
    }
  }

  async function registerPayment(reservation, paymentStatus = 'paid') {
    const paidAt = new Date().toISOString();
    const movement = {
      property_id: reservation.property_id,
      reservation_id: reservation.id,
      type: 'income',
      status: paymentStatus === 'paid' ? 'received' : 'expected',
      payment_method: reservation.payment_method || 'cash',
      amount: Number(reservation.total_amount || 0),
      due_date: format(new Date(), 'yyyy-MM-dd'),
      paid_at: paymentStatus === 'paid' ? paidAt : null,
      description: `Reserva ${reservation.guest_name}`,
    };

    setReservations((current) =>
      current.map((item) =>
        item.id === reservation.id
          ? {
              ...item,
              payment_status: paymentStatus,
            }
          : item,
      ),
    );
    setCashMovements((current) => [{ ...movement, id: crypto.randomUUID() }, ...current]);

    if (hasSupabaseConfig) {
      await supabase.from('reservations').update({ payment_status: paymentStatus }).eq('id', reservation.id);
      await supabase.from('cash_movements').insert(movement);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] text-ink" style={propertyThemeStyle}>
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-[#f4f8ff]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-3 font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-md text-white" style={{ background: 'var(--property-accent)' }}>
              <DoorOpen size={20} />
            </span>
            <span>{property.name}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
            <a href="#fotos">Fotos</a>
            <a href="#calendario">Calendário</a>
            <a href="#reserva">Reservar</a>
          </nav>
          <Button variant="outline" onClick={() => setAdminOpen(true)} aria-label="Abrir administracao">
            <Menu size={18} />
            Admin
          </Button>
        </div>
      </header>

      <main id="inicio">
        <section className="relative overflow-hidden bg-ink text-white">
          <img
            key={`hero-${property.id}-${selectedPhotoData?.id || 'photo'}`}
            className="property-fade absolute inset-0 h-full w-full object-cover opacity-70"
            src={selectedPhotoData?.url}
            alt={selectedPhotoData?.alt || 'Foto da casa'}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-transparent" />
          <div className="relative mx-auto grid min-h-[620px] max-w-7xl content-end px-4 pb-12 pt-28 sm:px-6 lg:px-8">
            <div key={`content-${property.id}-${propertyTransitionKey}`} className="property-panel max-w-2xl">
              <a
                className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/14 px-3 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
                href={buildMapsUrl(property)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${property.city} no Google Maps`}
              >
                <MapPin size={16} />
                {property.city}
              </a>
              <h1 className="text-4xl font-black leading-tight sm:text-6xl">{property.name}</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/90">{property.headline}</p>
              {properties.length > 1 ? (
                <div className="mt-5 max-w-full overflow-x-auto rounded-full bg-white/12 p-1.5 backdrop-blur-md">
                  <div className="flex min-w-max gap-1.5">
                    {properties.map((item) => (
                      <button
                        key={item.id}
                        className={`relative rounded-full px-3.5 py-2 text-xs font-bold transition duration-200 ${
                          item.id === property.id
                            ? 'bg-white text-ink shadow-[0_10px_24px_rgba(15,23,42,0.2)]'
                            : 'text-white/85 hover:bg-white/14 hover:text-white'
                        }`}
                        onClick={() => selectProperty(item.id)}
                      >
                        <span className="block max-w-32 truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => document.getElementById('reserva')?.scrollIntoView()}>
                  <CalendarDays size={18} />
                  Ver disponibilidade
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => document.getElementById('fotos')?.scrollIntoView()}
                >
                  Ver fotos
                </Button>
                <a
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-white via-blue-50 to-sky-100 px-5 py-2.5 text-sm font-bold text-ink shadow-[0_14px_30px_rgba(255,255,255,0.22)] transition duration-200 hover:-translate-y-0.5 hover:from-blue-50 hover:to-white"
                  href={buildWhatsAppUrl(
                    property.owner_whatsapp || fallbackOwnerWhatsapp,
                    `Ola, tenho interesse em conversar sobre ${property.name}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} />
                  Mensagem privada
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-ink/10 bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <InfoStat icon={BedDouble} label="Quartos" value={property.bedrooms} />
            <InfoStat icon={DoorOpen} label="Banheiros" value={property.bathrooms} />
            <InfoStat icon={Users} label="Hóspedes" value={`até ${property.max_guests}`} />
            <InfoStat icon={CreditCard} label="Diária" value={currency.format(property.daily_rate)} />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
          <div>
            <p className="text-base leading-8 text-ink/75">{property.description}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {property.amenities?.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md bg-white px-4 py-3 shadow-sm">
                  <Check className="text-leaf" size={18} />
                  <span className="font-semibold">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <aside className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-1 text-leaf" />
              <div>
                <h2 className="text-xl font-black">Reserva segura</h2>
                <p className="mt-2 text-sm leading-6 text-ink/70">
                  Os dados são enviados ao Supabase com políticas de segurança. Pagamentos reais
                  devem ser conectados por um provedor oficial.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section id="fotos" className="bg-mist py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black">Fotos da casa</h2>
                <p className="mt-2 text-ink/70">A galeria atualiza quando você adiciona novas fotos.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <img
                className="h-[360px] w-full rounded-md object-cover shadow-soft sm:h-[540px]"
                src={selectedPhotoData?.url}
                alt={selectedPhotoData?.alt || 'Foto selecionada'}
              />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                {propertyPhotos.slice(0, 4).map((photo, index) => (
                  <button
                    key={photo.id}
                    className={`h-40 overflow-hidden rounded-md border-2 bg-white ${
                      selectedPhoto === index ? 'border-coral' : 'border-transparent'
                    }`}
                    onClick={() => setSelectedPhoto(index)}
                  >
                    <img className="h-full w-full object-cover" src={photo.url} alt={photo.alt} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="calendario" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-black">Disponibilidade</h2>
              <p className="mt-2 text-ink/70">Datas em vermelho ja estao reservadas ou bloqueadas.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMonth(addDays(startOfMonth(month), -1))}>
                Anterior
              </Button>
              <Button variant="outline" onClick={() => setMonth(addDays(endOfMonth(month), 1))}>
                Proximo
              </Button>
            </div>
          </div>
          <CalendarGrid month={month} bookedDates={bookedDates} />
        </section>

        <section id="reserva" className="bg-white py-14">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
            <form className="grid gap-5" onSubmit={createReservation}>
              <div>
                <h2 className="text-3xl font-black">Solicitar reserva</h2>
                <p className="mt-2 text-ink/70">
                  Informe os dados para check-in, check-out e conferência da reserva.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Check-in">
                  <TextInput
                    type="date"
                    value={booking.check_in}
                    onChange={(event) => setBooking({ ...booking, check_in: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Check-out">
                  <TextInput
                    type="date"
                    value={booking.check_out}
                    onChange={(event) => setBooking({ ...booking, check_out: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Hóspedes">
                  <TextInput
                    type="number"
                    min="1"
                    max={property.max_guests}
                    value={booking.guests}
                    onChange={(event) => setBooking({ ...booking, guests: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Nome completo">
                  <TextInput
                    value={booking.guest_name}
                    onChange={(event) => setBooking({ ...booking, guest_name: event.target.value })}
                    placeholder="Seu nome"
                    required
                  />
                </Field>
                <Field label="E-mail">
                  <TextInput
                    type="email"
                    value={booking.guest_email}
                    onChange={(event) => setBooking({ ...booking, guest_email: event.target.value })}
                    placeholder="seu@email.com"
                    required
                  />
                </Field>
                <Field label="Telefone">
                  <TextInput
                    value={booking.guest_phone}
                    onChange={(event) => setBooking({ ...booking, guest_phone: event.target.value })}
                    placeholder="(00) 00000-0000"
                    required
                  />
                </Field>
                <Field label="Documento">
                  <TextInput
                    value={booking.guest_document}
                    onChange={(event) => setBooking({ ...booking, guest_document: event.target.value })}
                    placeholder="CPF ou passaporte"
                    required
                  />
                </Field>
                <Field label="Forma de pagamento">
                  <SelectInput
                    value={booking.payment_method}
                    onChange={(event) => setBooking({ ...booking, payment_method: event.target.value })}
                    required
                  >
                    <option value="pix">Pix</option>
                    <option value="card">Cartão</option>
                    <option value="cash">Dinheiro</option>
                    <option value="check">Cheque</option>
                  </SelectInput>
                </Field>
              </div>
              <Field label="Observações">
                <TextArea
                  value={booking.notes}
                  onChange={(event) => setBooking({ ...booking, notes: event.target.value })}
                  placeholder="Horário aproximado de chegada, dúvidas ou pedidos especiais"
                  required
                />
              </Field>
              {reservationConflict ? (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  Essas datas conflitam com uma reserva existente.
                </p>
              ) : null}
              <Button className="w-full sm:w-fit" type="submit" disabled={!canBook}>
                <MessageCircle size={18} />
                Enviar solicitacao
              </Button>
            </form>

            <aside className="h-fit rounded-md border border-ink/10 bg-[#f4f8ff] p-5 shadow-soft">
              <h3 className="text-2xl font-black">Resumo</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <SummaryRow label="Diárias" value={`${nights} noite(s)`} />
                <SummaryRow label="Valor por diária" value={currency.format(property.daily_rate)} />
                <SummaryRow label="Limpeza" value={nights > 0 ? currency.format(property.cleaning_fee) : '-'} />
                <SummaryRow label="Pagamento" value={paymentLabels[booking.payment_method]} />
                <div className="mt-3 border-t border-ink/10 pt-4">
                  <SummaryRow label="Total estimado" value={currency.format(total)} strong />
                </div>
              </div>
              <div className="mt-6 rounded-md bg-white p-4 text-sm leading-6 text-ink/70">
                Depois do envio, a reserva fica pendente até a confirmação do proprietário.
              </div>
              {message ? <p className="mt-4 rounded-md bg-mist px-4 py-3 text-sm font-semibold">{message}</p> : null}
            </aside>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 bg-ink px-4 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{property.name}</p>
          <p className="text-sm text-white/70">Reservas, calendario e check-in online.</p>
        </div>
      </footer>

      {adminOpen ? (
        <AdminPanel
          addProperty={addProperty}
          addPhoto={addPhoto}
          adminUnlocked={adminUnlocked}
          adminSession={adminSession}
          onClose={() => setAdminOpen(false)}
          onUnlock={() => setAdminUnlocked(true)}
          onSelectProperty={selectProperty}
          properties={properties}
          property={property}
          reservations={propertyReservations}
          cashMovements={propertyCashMovements}
          financialSummary={financialSummary}
          registerPayment={registerPayment}
          saveProperty={saveProperty}
          updateReservationStatus={updateReservationStatus}
        />
      ) : null}

      {loading ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#f4f8ff]/90 font-bold">
          Carregando informacoes...
        </div>
      ) : null}
    </div>
  );
}

function InfoStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-md bg-mist text-leaf">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink/50">{label}</p>
        <p className="text-lg font-black">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'text-lg font-black' : ''}`}>
      <span className="text-ink/65">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function FinanceCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-mist text-leaf">
          <Icon size={18} />
        </span>
        <span className="text-sm font-semibold text-ink/65">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}

function CalendarGrid({ month, bookedDates }) {
  const days = buildCalendarDays(month);
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <div className="overflow-hidden rounded-md border border-ink/10 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-4">
        <h3 className="text-xl font-black">{format(month, "MMMM 'de' yyyy", { locale: ptBR })}</h3>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-leaf" />
            Livre
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-coral" />
            Ocupado
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-ink/10 bg-mist text-center text-xs font-black uppercase tracking-wide text-ink/60">
        {weekDays.map((day) => (
          <div key={day} className="px-2 py-3">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const booked = bookedDates.has(dateKey(day));
          const outsideMonth = day.getMonth() !== month.getMonth();
          const today = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={`calendar-cell border-b border-r border-ink/10 p-2 ${
                outsideMonth ? 'bg-[#f8fbff] text-ink/30' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-md text-sm font-black ${
                    today ? 'bg-ink text-white' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
                <span
                  className={`rounded-sm px-2 py-1 text-[11px] font-black ${
                    booked ? 'bg-coral text-white' : 'bg-leaf/10 text-leaf'
                  }`}
                >
                  {booked ? 'Ocupado' : 'Livre'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminPanel({
  addProperty,
  addPhoto,
  adminUnlocked,
  adminSession,
  cashMovements,
  financialSummary,
  onClose,
  onSelectProperty,
  onUnlock,
  properties,
  property,
  registerPayment,
  reservations,
  saveProperty,
  updateReservationStatus,
}) {
  const [login, setLogin] = useState({ email: adminEmail, password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [expandedReservationId, setExpandedReservationId] = useState('');
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [reportType, setReportType] = useState('summary');
  const [draft, setDraft] = useState({
    ...property,
    amenities: property.amenities?.join(', ') || '',
    rules: property.rules?.join(', ') || '',
  });
  const [newProperty, setNewProperty] = useState({
    ...emptyProperty,
    name: '',
    city: '',
    maps_url: '',
    headline: '',
    description: '',
    amenities: '',
    rules: '',
  });
  const [photo, setPhoto] = useState({ url: '', alt: '' });
  const visibleReservations = reservations.filter((reservation) => reservation.status !== 'cancelled');
  const reportLabels = {
    summary: 'Resumo gerencial',
    reservations: 'Reservas',
    financial: 'Financeiro',
    occupancy: 'Ocupação e desempenho',
    guests: 'Hóspedes',
  };

  useEffect(() => {
    setDraft({
      ...property,
      amenities: property.amenities?.join(', ') || '',
      rules: property.rules?.join(', ') || '',
    });
    setPhoto({ url: '', alt: '' });
  }, [property]);

  function submitProperty(event) {
    event.preventDefault();
    saveProperty({
      ...draft,
      daily_rate: Number(draft.daily_rate),
      cleaning_fee: Number(draft.cleaning_fee),
      max_guests: Number(draft.max_guests),
      bedrooms: Number(draft.bedrooms),
      bathrooms: Number(draft.bathrooms),
      amenities: draft.amenities.split(',').map((item) => item.trim()).filter(Boolean),
      rules: draft.rules.split(',').map((item) => item.trim()).filter(Boolean),
    });
  }

  function submitNewProperty(event) {
    event.preventDefault();
    addProperty({
      ...newProperty,
      daily_rate: Number(newProperty.daily_rate),
      cleaning_fee: Number(newProperty.cleaning_fee),
      max_guests: Number(newProperty.max_guests),
      bedrooms: Number(newProperty.bedrooms),
      bathrooms: Number(newProperty.bathrooms),
      amenities: String(newProperty.amenities || '').split(',').map((item) => item.trim()).filter(Boolean),
      rules: String(newProperty.rules || '').split(',').map((item) => item.trim()).filter(Boolean),
    });
    setNewProperty({
      ...emptyProperty,
      name: '',
      city: '',
      headline: '',
      description: '',
      maps_url: '',
      amenities: '',
      rules: '',
    });
    setShowNewProperty(false);
  }

  function confirmReservation(reservation) {
    updateReservationStatus(reservation.id, 'confirmed');
    const whatsAppUrl = buildWhatsAppUrl(
      reservation.guest_phone,
      buildGuestConfirmationMessage(property, reservation),
    );
    if (whatsAppUrl) window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
  }

  function generateReportPdf() {
    const doc = new jsPDF();
    const activeReservations = visibleReservations.filter((reservation) => reservation.status !== 'cancelled');
    const confirmedReservations = activeReservations.filter((reservation) => reservation.status === 'confirmed');
    const nightsBooked = confirmedReservations.reduce((sum, reservation) => {
      const nights = Math.max(0, differenceInCalendarDays(toDate(reservation.check_out), toDate(reservation.check_in)));
      return sum + nights;
    }, 0);
    const totalRevenue = activeReservations.reduce((sum, reservation) => sum + Number(reservation.total_amount || 0), 0);
    const received = cashMovements
      .filter((movement) => movement.status === 'received')
      .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
    const occupancy = Math.round((nightsBooked / 365) * 100);
    const adr = nightsBooked ? totalRevenue / nightsBooked : 0;

    const linesByType = {
      summary: [
        `Casa: ${property.name}`,
        `Reservas ativas: ${activeReservations.length}`,
        `Reservas confirmadas: ${confirmedReservations.length}`,
        `Noites confirmadas: ${nightsBooked}`,
        `Receita prevista: ${currency.format(totalRevenue)}`,
        `Recebido: ${currency.format(received)}`,
        `Ocupação estimada no ano: ${occupancy}%`,
        `Diária média estimada: ${currency.format(adr)}`,
      ],
      reservations: activeReservations.map(
        (reservation) =>
          `${reservation.guest_name} | ${reservation.check_in} até ${reservation.check_out} | ${reservation.status} | ${currency.format(reservation.total_amount || 0)}`,
      ),
      financial: [
        `Receita prevista: ${currency.format(totalRevenue)}`,
        `Recebido: ${currency.format(received)}`,
        `A receber: ${currency.format(Math.max(0, totalRevenue - received))}`,
        '',
        ...cashMovements.map(
          (movement) =>
            `${movement.due_date} | ${movement.description || 'Lançamento'} | ${movement.status} | ${currency.format(movement.amount || 0)}`,
        ),
      ],
      occupancy: [
        `Noites confirmadas: ${nightsBooked}`,
        `Ocupação estimada no ano: ${occupancy}%`,
        `Diária média estimada: ${currency.format(adr)}`,
        `Receita por noite disponível: ${currency.format(totalRevenue / 365)}`,
      ],
      guests: activeReservations.map(
        (reservation) =>
          `${reservation.guest_name} | ${reservation.guest_phone || '-'} | ${reservation.guest_email || '-'} | ${reservation.guest_document || '-'}`,
      ),
    };

    const title = reportLabels[reportType];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, 14, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${property.name}`, 14, 26);

    let y = 40;
    const rows = linesByType[reportType].length ? linesByType[reportType] : ['Nenhum dado disponível para este relatório.'];
    rows.forEach((line) => {
      const wrapped = doc.splitTextToSize(line || ' ', 180);
      if (y + wrapped.length * 6 > 285) {
        doc.addPage();
        y = 18;
      }
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6 + 2;
    });

    doc.save(`${property.name}-${reportType}.pdf`.replace(/\s+/g, '-').toLowerCase());
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/55 p-3 backdrop-blur-sm">
      <div className="ml-auto h-full max-w-3xl overflow-auto rounded-md bg-[#f4f8ff] shadow-soft">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/15 bg-leaf px-5 py-4 text-white">
          <div>
            <h2 className="text-2xl font-black">Administração</h2>
            <p className="text-sm text-white/75">Atualize valores, fotos e reservas.</p>
          </div>
          <Button variant="outline" onClick={onClose} aria-label="Fechar painel">
            <X size={18} />
          </Button>
        </div>

        {!adminUnlocked ? (
          <form
            className="grid gap-4 p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setLoginError('');
              setLoginNotice('');

              if (hasSupabaseConfig) {
                const nextLogin = { email: login.email.trim(), password: login.password };
                const { data, error } = await supabase.auth.signInWithPassword(nextLogin);
                if (error?.message === 'Email not confirmed') {
                  setLoginError('E-mail ainda nao confirmado.');
                  setLoginNotice(
                    'Abra o e-mail de confirmação do Supabase. Se o link deu erro, confira a URL do site no Supabase Auth.',
                  );
                  return;
                }
                if (error) setLoginError('Login nao autorizado. Confira e-mail e senha.');
                if (data?.user && !isAdminEmail(data.user.email)) {
                  await supabase.auth.signOut();
                  setLoginError('Este e-mail não tem permissão de administrador.');
                }
                return;
              }

              if (!canUseLocalAdmin) {
                setLoginError('Admin indisponivel sem Supabase Auth configurado.');
                setLoginNotice('Configure o Supabase Auth para proteger o painel quando publicar o site.');
                return;
              }

              if (isAdminEmail(login.email.trim()) && login.password === localAdminPassword) {
                onUnlock();
                return;
              }

              setLoginError('Login nao autorizado. Confira e-mail e senha.');
            }}
          >
            <Field label="E-mail do administrador">
              <TextInput
                type="email"
                value={login.email}
                onChange={(event) => setLogin({ ...login, email: event.target.value })}
                placeholder={adminEmail}
                autoComplete="username"
              />
            </Field>
            <Field label="Senha">
              <TextInput
                type="password"
                value={login.password}
                onChange={(event) => setLogin({ ...login, password: event.target.value })}
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </Field>
            {!hasSupabaseConfig ? null : (
              <p className="text-xs font-semibold text-ink/55">Administrador autorizado: {adminEmail}</p>
            )}
            <Button type="submit">
              <Lock size={18} />
              Entrar
            </Button>
            {loginError ? <p className="text-sm font-semibold text-red-700">{loginError}</p> : null}
            {loginNotice ? <p className="text-sm leading-6 text-ink/70">{loginNotice}</p> : null}
            {hasSupabaseConfig && login.email ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setLoginError('');
                  setLoginNotice('');
                  const { error } = await supabase.auth.resend({
                    type: 'signup',
                    email: login.email,
                    options: {
                      emailRedirectTo: window.location.origin,
                    },
                  });
                  if (error) {
                    setLoginError('Não foi possível reenviar agora.');
                    return;
                  }
                  setLoginNotice('Novo e-mail de confirmação enviado.');
                }}
              >
                Reenviar confirmação
              </Button>
            ) : null}
            <p className="text-sm leading-6 text-ink/65">
              {hasSupabaseConfig
                ? 'Use o usuário administrador criado no Supabase Auth para administrar o site.'
                : 'Login local disponível apenas no desenvolvimento. Em produção, configure Supabase Auth.'}
            </p>
          </form>
        ) : (
          <div className="grid gap-8 p-5">
            {adminSession ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold">Logado como {adminSession.user.email}</p>
                <Button variant="outline" onClick={() => supabase.auth.signOut()}>
                  Sair
                </Button>
              </div>
            ) : null}
            <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Minhas casas</h3>
                  <p className="mt-1 text-sm text-ink/65">Escolha qual casa deseja editar ou acompanhar.</p>
                </div>
                <button
                  type="button"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-700 text-2xl font-black leading-none text-white shadow-[0_16px_34px_rgba(37,99,235,0.36)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(37,99,235,0.44)]"
                  onClick={() => setShowNewProperty((current) => !current)}
                  aria-label="Cadastrar nova casa"
                >
                  {showNewProperty ? 'x' : '+'}
                </button>
              </div>
              <div className="grid gap-2">
                {properties.map((item) => (
                  <button
                    key={item.id}
                    className={`rounded-xl border px-3 py-2 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 ${
                      item.id === property.id
                        ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-sky-100'
                        : 'border-ink/10 bg-white hover:border-blue-200 hover:bg-mist'
                    }`}
                    onClick={() => onSelectProperty(item.id)}
                  >
                    <span className="block text-xs font-black">{item.name}</span>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-ink/60">{item.city}</span>
                  </button>
                ))}
              </div>
            </section>

            {showNewProperty ? (
              <form className="grid gap-4 rounded-md border border-leaf/20 bg-white p-4 shadow-sm" onSubmit={submitNewProperty}>
                <h3 className="text-xl font-black">Cadastrar nova casa</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome">
                    <TextInput
                      value={newProperty.name}
                      onChange={(event) => setNewProperty({ ...newProperty, name: event.target.value })}
                      placeholder="Casa do Lago"
                      required
                    />
                  </Field>
                  <Field label="Cidade">
                    <TextInput
                      value={newProperty.city}
                      onChange={(event) => setNewProperty({ ...newProperty, city: event.target.value })}
                      placeholder="Cidade, UF"
                      required
                    />
                  </Field>
                  <Field label="Link do Google Maps">
                    <TextInput
                      type="url"
                      value={newProperty.maps_url || ''}
                      onChange={(event) => setNewProperty({ ...newProperty, maps_url: event.target.value })}
                      placeholder="https://maps.google.com/..."
                    />
                  </Field>
                  <Field label="Cor da página">
                    <div className="flex items-center gap-3 rounded-xl border border-ink/15 bg-white px-3 py-2 shadow-sm">
                      <input
                        type="color"
                        value={newProperty.theme_color || '#2563eb'}
                        onChange={(event) => setNewProperty({ ...newProperty, theme_color: event.target.value })}
                        className="h-9 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
                      />
                      <TextInput
                        value={newProperty.theme_color || '#2563eb'}
                        onChange={(event) => setNewProperty({ ...newProperty, theme_color: event.target.value })}
                        placeholder="#2563eb"
                      />
                    </div>
                  </Field>
                  <Field label="Diária">
                    <TextInput
                      type="number"
                      value={newProperty.daily_rate}
                      onChange={(event) => setNewProperty({ ...newProperty, daily_rate: event.target.value })}
                    />
                  </Field>
                  <Field label="Taxa de limpeza">
                    <TextInput
                      type="number"
                      value={newProperty.cleaning_fee}
                      onChange={(event) => setNewProperty({ ...newProperty, cleaning_fee: event.target.value })}
                    />
                  </Field>
                  <Field label="Hóspedes máximos">
                    <TextInput
                      type="number"
                      value={newProperty.max_guests}
                      onChange={(event) => setNewProperty({ ...newProperty, max_guests: event.target.value })}
                    />
                  </Field>
                  <Field label="Quartos">
                    <TextInput
                      type="number"
                      value={newProperty.bedrooms}
                      onChange={(event) => setNewProperty({ ...newProperty, bedrooms: event.target.value })}
                    />
                  </Field>
                  <Field label="Banheiros">
                    <TextInput
                      type="number"
                      value={newProperty.bathrooms}
                      onChange={(event) => setNewProperty({ ...newProperty, bathrooms: event.target.value })}
                    />
                  </Field>
                  <Field label="WhatsApp do proprietário">
                    <TextInput
                      value={newProperty.owner_whatsapp}
                      onChange={(event) => setNewProperty({ ...newProperty, owner_whatsapp: event.target.value })}
                      placeholder={fallbackOwnerWhatsapp}
                    />
                  </Field>
                </div>
                <Field label="Chamada">
                  <TextInput
                    value={newProperty.headline}
                    onChange={(event) => setNewProperty({ ...newProperty, headline: event.target.value })}
                    placeholder="Resumo curto da casa"
                    required
                  />
                </Field>
                <Field label="Descrição">
                  <TextArea
                    value={newProperty.description}
                    onChange={(event) => setNewProperty({ ...newProperty, description: event.target.value })}
                    placeholder="Detalhes para o cliente"
                    required
                  />
                </Field>
                <Field label="Comodidades separadas por vírgula">
                  <TextInput
                    value={newProperty.amenities}
                    onChange={(event) => setNewProperty({ ...newProperty, amenities: event.target.value })}
                    placeholder="Wi-Fi, Churrasqueira, Piscina"
                  />
                </Field>
                <Button type="submit" variant="secondary">
                  <DoorOpen size={18} />
                  Cadastrar casa
                </Button>
              </form>
            ) : null}

            <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
              <div>
                <h3 className="text-xl font-black">Caixa</h3>
                <p className="mt-1 text-sm text-ink/65">Acompanhe o que entrou e o que ainda tem para receber.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FinanceCard icon={Banknote} label="Recebido" value={currency.format(financialSummary.received)} />
                <FinanceCard icon={CreditCard} label="A receber" value={currency.format(financialSummary.receivable)} />
                <FinanceCard icon={CalendarDays} label="Previsão" value={currency.format(financialSummary.forecast)} />
              </div>
              <div className="grid gap-2 rounded-md bg-white p-4 shadow-sm">
                <p className="text-sm font-black">Últimos lançamentos</p>
                {cashMovements.length ? (
                  cashMovements.slice(0, 5).map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-ink/70">{movement.description}</span>
                      <span className="font-bold">{currency.format(movement.amount || 0)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">Nenhum recebimento registrado ainda.</p>
                )}
              </div>
            </section>

            <section className="grid gap-4 rounded-md bg-white p-4 shadow-sm">
              <div>
                <h3 className="text-xl font-black">Relatórios</h3>
                <p className="mt-1 text-sm text-ink/65">
                  Emita PDFs com reservas, financeiro, ocupação e hóspedes da casa selecionada.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label="Tipo de relatório">
                  <SelectInput value={reportType} onChange={(event) => setReportType(event.target.value)}>
                    {Object.entries(reportLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="flex items-end">
                  <Button type="button" onClick={generateReportPdf}>
                    <Save size={18} />
                    Emitir PDF
                  </Button>
                </div>
              </div>
            </section>

            <form className="grid gap-4 rounded-md bg-white p-4 shadow-sm" onSubmit={submitProperty}>
              <h3 className="text-xl font-black">Dados da casa</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <Field label="Cidade">
                  <TextInput value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
                </Field>
                <Field label="Link do Google Maps">
                  <TextInput
                    type="url"
                    value={draft.maps_url || ''}
                    onChange={(event) => setDraft({ ...draft, maps_url: event.target.value })}
                    placeholder="https://maps.google.com/..."
                  />
                </Field>
                <Field label="Cor da página">
                  <div className="flex items-center gap-3 rounded-xl border border-ink/15 bg-white px-3 py-2 shadow-sm">
                    <input
                      type="color"
                      value={draft.theme_color || '#2563eb'}
                      onChange={(event) => setDraft({ ...draft, theme_color: event.target.value })}
                      className="h-9 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    />
                    <TextInput
                      value={draft.theme_color || '#2563eb'}
                      onChange={(event) => setDraft({ ...draft, theme_color: event.target.value })}
                      placeholder="#2563eb"
                    />
                  </div>
                </Field>
                <Field label="WhatsApp do proprietário">
                  <TextInput
                    value={draft.owner_whatsapp || ''}
                    onChange={(event) => setDraft({ ...draft, owner_whatsapp: event.target.value })}
                    placeholder={fallbackOwnerWhatsapp}
                  />
                </Field>
                <Field label="Diária">
                  <TextInput
                    type="number"
                    value={draft.daily_rate}
                    onChange={(event) => setDraft({ ...draft, daily_rate: event.target.value })}
                  />
                </Field>
                <Field label="Taxa de limpeza">
                  <TextInput
                    type="number"
                    value={draft.cleaning_fee}
                    onChange={(event) => setDraft({ ...draft, cleaning_fee: event.target.value })}
                  />
                </Field>
                <Field label="Hóspedes máximos">
                  <TextInput
                    type="number"
                    value={draft.max_guests}
                    onChange={(event) => setDraft({ ...draft, max_guests: event.target.value })}
                  />
                </Field>
                <Field label="Quartos">
                  <TextInput
                    type="number"
                    value={draft.bedrooms}
                    onChange={(event) => setDraft({ ...draft, bedrooms: event.target.value })}
                  />
                </Field>
                <Field label="Banheiros">
                  <TextInput
                    type="number"
                    value={draft.bathrooms}
                    onChange={(event) => setDraft({ ...draft, bathrooms: event.target.value })}
                  />
                </Field>
              </div>
              <Field label="Chamada">
                <TextArea
                  value={draft.headline}
                  onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
                />
              </Field>
              <Field label="Descrição">
                <TextArea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              <Field label="Comodidades separadas por vírgula">
                <TextInput
                  value={draft.amenities}
                  onChange={(event) => setDraft({ ...draft, amenities: event.target.value })}
                />
              </Field>
              <Button type="submit">
                <Save size={18} />
                Salvar dados
              </Button>
            </form>

            <form
              className="grid gap-4 rounded-md bg-white p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                addPhoto(photo);
                setPhoto({ url: '', alt: '' });
              }}
            >
              <h3 className="text-xl font-black">Adicionar foto</h3>
              <Field label="URL da foto">
                <TextInput
                  value={photo.url}
                  onChange={(event) => setPhoto({ ...photo, url: event.target.value })}
                  placeholder="https://..."
                  required
                />
              </Field>
              <Field label="Descrição da foto">
                <TextInput
                  value={photo.alt}
                  onChange={(event) => setPhoto({ ...photo, alt: event.target.value })}
                  placeholder="Sala, quarto, fachada..."
                />
              </Field>
              <Button type="submit" variant="secondary">
                <ImagePlus size={18} />
                Adicionar foto
              </Button>
            </form>

            <section className="rounded-md bg-white p-4 shadow-sm">
              <h3 className="text-xl font-black">Reservas</h3>
              <div className="mt-4 grid gap-3">
                {visibleReservations.length ? (
                  visibleReservations.map((reservation) => {
                    const expanded = expandedReservationId === reservation.id;
                    return (
                      <div
                        key={reservation.id}
                        className="cursor-pointer rounded-md bg-white p-4 shadow-sm transition hover:bg-mist"
                        onClick={() => setExpandedReservationId(expanded ? '' : reservation.id)}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black">{reservation.guest_name}</p>
                        <p className="text-sm text-ink/65">
                          {reservation.check_in} até {reservation.check_out} - {reservation.guests} hóspede(s)
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {currency.format(reservation.total_amount || 0)} - {reservation.status}
                        </p>
                        <p className="mt-1 text-sm text-ink/65">
                          {paymentLabels[reservation.payment_method] || 'A combinar'} -{' '}
                          {reservation.payment_status === 'paid' ? 'pago' : 'a receber'}
                        </p>
                        <p className="mt-1 text-sm text-ink/65">
                          {reservation.guest_phone || reservation.guest_email}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reservation.guest_phone ? (
                          <a
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                            href={buildWhatsAppUrl(
                              reservation.guest_phone,
                              `Ola, ${reservation.guest_name}. Estou falando sobre sua solicitacao de reserva em ${property.name}.`,
                            )}
                            onClick={(event) => event.stopPropagation()}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={16} />
                            WhatsApp
                          </a>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            confirmReservation(reservation);
                          }}
                        >
                          <Check size={16} />
                          Confirmar
                        </Button>
                        {reservation.payment_status !== 'paid' ? (
                          <Button
                            variant="secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              registerPayment(reservation, 'paid');
                            }}
                          >
                            <Banknote size={16} />
                            Recebido
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateReservationStatus(reservation.id, 'cancelled');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                    {expanded ? (
                      <div className="mt-4 grid gap-2 border-t border-ink/10 pt-4 text-sm text-ink/75">
                        <p><strong>E-mail:</strong> {reservation.guest_email || '-'}</p>
                        <p><strong>Telefone:</strong> {reservation.guest_phone || '-'}</p>
                        <p><strong>Documento:</strong> {reservation.guest_document || '-'}</p>
                        <p><strong>Hóspedes:</strong> {reservation.guests}</p>
                        <p><strong>Pagamento:</strong> {paymentLabels[reservation.payment_method] || 'A combinar'}</p>
                        <p><strong>Total:</strong> {currency.format(reservation.total_amount || 0)}</p>
                        <p><strong>Observações:</strong> {reservation.notes || '-'}</p>
                      </div>
                    ) : null}
                  </div>
                    );
                  })
                ) : (
                  <p className="rounded-md bg-white p-4 text-sm font-semibold text-ink/60 shadow-sm">
                    Nenhuma reserva ativa para esta casa.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
