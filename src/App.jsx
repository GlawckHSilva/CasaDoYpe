import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
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
import { demoPhotos, demoProperty, demoReservations } from './data/demo';
import { hasSupabaseConfig, supabase } from './lib/supabase';

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const adminPin = '1234';
const fallbackOwnerWhatsapp = import.meta.env.VITE_OWNER_WHATSAPP || '';

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

function buildReservationMessage({ property, reservation, nights }) {
  return [
    `Nova solicitacao de reserva - ${property.name}`,
    '',
    `Nome: ${reservation.guest_name}`,
    `Telefone: ${reservation.guest_phone}`,
    `Email: ${reservation.guest_email}`,
    reservation.guest_document ? `Documento: ${reservation.guest_document}` : null,
    `Check-in: ${reservation.check_in}`,
    `Check-out: ${reservation.check_out}`,
    `Noites: ${nights}`,
    `Hospedes: ${reservation.guests}`,
    `Total estimado: ${currency.format(reservation.total_amount || 0)}`,
    reservation.notes ? `Observacoes: ${reservation.notes}` : null,
    '',
    `Codigo da reserva: ${reservation.id}`,
    'Aguardando confirmacao do proprietario.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildWhatsAppUrl(phone, message) {
  const digits = onlyDigits(phone);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function Button({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'bg-coral text-white hover:bg-[#c85843]',
    secondary: 'bg-ink text-white hover:bg-[#263328]',
    ghost: 'bg-white/80 text-ink hover:bg-white',
    outline: 'border border-ink/15 bg-white text-ink hover:bg-mist',
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
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

export default function App() {
  const [property, setProperty] = useState(demoProperty);
  const [photos, setPhotos] = useState(demoPhotos);
  const [reservations, setReservations] = useState(demoReservations);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [month, setMonth] = useState(new Date());
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminSession, setAdminSession] = useState(null);
  const [message, setMessage] = useState('');
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState({
    check_in: '',
    check_out: '',
    guests: 2,
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    guest_document: '',
    notes: '',
  });

  const bookedDates = useMemo(() => getBookedDates(reservations), [reservations]);
  const nights = useMemo(() => {
    if (!booking.check_in || !booking.check_out) return 0;
    return Math.max(0, differenceInCalendarDays(toDate(booking.check_out), toDate(booking.check_in)));
  }, [booking.check_in, booking.check_out]);
  const subtotal = nights * Number(property.daily_rate || 0);
  const total = subtotal + (nights > 0 ? Number(property.cleaning_fee || 0) : 0);
  const reservationConflict = hasConflict(reservations, booking.check_in, booking.check_out);
  const canBook =
    nights > 0 &&
    !reservationConflict &&
    booking.guest_name &&
    booking.guest_email &&
    booking.guest_phone &&
    Number(booking.guests) > 0 &&
    Number(booking.guests) <= property.max_guests;

  useEffect(() => {
    async function loadData() {
      if (!hasSupabaseConfig) {
        setLoading(false);
        return;
      }

      const [{ data: propertyRows }, { data: photoRows }, { data: reservationRows }] =
        await Promise.all([
          supabase.from('properties').select('*').limit(1),
          supabase.from('property_photos').select('*').order('sort_order'),
          supabase.from('reservations').select('*').order('check_in'),
        ]);

      if (propertyRows?.[0]) setProperty(propertyRows[0]);
      if (photoRows?.length) setPhotos(photoRows);
      if (reservationRows?.length) setReservations(reservationRows);
      setLoading(false);
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setAdminSession(data.session);
      setAdminUnlocked(Boolean(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminSession(session);
      setAdminUnlocked(Boolean(session));
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
    };

    if (hasSupabaseConfig) {
      const { data, error } = await supabase.from('reservations').insert(reservation).select().single();
      if (error) {
        setMessage('Nao foi possivel criar a reserva agora. Confira os dados e tente novamente.');
        return;
      }
      const whatsAppUrl = buildWhatsAppUrl(
        property.owner_whatsapp || fallbackOwnerWhatsapp,
        buildReservationMessage({ property, reservation: data, nights }),
      );
      setLastWhatsAppUrl(whatsAppUrl);
      setReservations((current) => [...current, data]);
      if (whatsAppUrl) window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    } else {
      const localReservation = { ...reservation, id: crypto.randomUUID() };
      const whatsAppUrl = buildWhatsAppUrl(
        property.owner_whatsapp || fallbackOwnerWhatsapp,
        buildReservationMessage({ property, reservation: localReservation, nights }),
      );
      setLastWhatsAppUrl(whatsAppUrl);
      setReservations((current) => [...current, localReservation]);
      if (whatsAppUrl) window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    }

    setMessage(
      property.owner_whatsapp || fallbackOwnerWhatsapp
        ? 'Solicitacao criada e mensagem do WhatsApp preparada. A reserva fica pendente ate voce confirmar no Admin.'
        : 'Solicitacao criada. Cadastre o WhatsApp do proprietario no Admin para enviar automaticamente.',
    );
    setBooking({
      check_in: '',
      check_out: '',
      guests: 2,
      guest_name: '',
      guest_email: '',
      guest_phone: '',
      guest_document: '',
      notes: '',
    });
  }

  async function saveProperty(updated) {
    setProperty(updated);
    if (hasSupabaseConfig) {
      await supabase.from('properties').update(updated).eq('id', updated.id);
    }
    setMessage('Informacoes da casa atualizadas.');
  }

  async function addPhoto(photo) {
    const nextPhoto = {
      id: crypto.randomUUID(),
      property_id: property.id,
      sort_order: photos.length + 1,
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

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-ink">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-[#f7f4ee]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-3 font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-leaf text-white">
              <DoorOpen size={20} />
            </span>
            <span>{property.name}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
            <a href="#fotos">Fotos</a>
            <a href="#calendario">Calendario</a>
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
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            src={photos[selectedPhoto]?.url}
            alt={photos[selectedPhoto]?.alt || 'Foto da casa'}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-transparent" />
          <div className="relative mx-auto grid min-h-[620px] max-w-7xl content-end px-4 pb-12 pt-28 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/14 px-3 py-2 text-sm font-semibold backdrop-blur">
                <MapPin size={16} />
                {property.city}
              </div>
              <h1 className="text-4xl font-black leading-tight sm:text-6xl">{property.name}</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/90">{property.headline}</p>
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
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-ink/10 bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <InfoStat icon={BedDouble} label="Quartos" value={property.bedrooms} />
            <InfoStat icon={DoorOpen} label="Banheiros" value={property.bathrooms} />
            <InfoStat icon={Users} label="Hospedes" value={`ate ${property.max_guests}`} />
            <InfoStat icon={CreditCard} label="Diaria" value={currency.format(property.daily_rate)} />
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
                  Os dados sao enviados ao Supabase com politicas de seguranca. Pagamentos reais
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
                <p className="mt-2 text-ink/70">A galeria atualiza quando voce adiciona novas fotos.</p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <img
                className="h-[360px] w-full rounded-md object-cover shadow-soft sm:h-[540px]"
                src={photos[selectedPhoto]?.url}
                alt={photos[selectedPhoto]?.alt || 'Foto selecionada'}
              />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                {photos.slice(0, 4).map((photo, index) => (
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
                  Informe os dados para check-in, check-out e conferencia da reserva.
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
                <Field label="Hospedes">
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
                    placeholder="voce@email.com"
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
                  />
                </Field>
              </div>
              <Field label="Observacoes">
                <TextArea
                  value={booking.notes}
                  onChange={(event) => setBooking({ ...booking, notes: event.target.value })}
                  placeholder="Horario aproximado de chegada, duvidas ou pedidos especiais"
                />
              </Field>
              {reservationConflict ? (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  Essas datas conflitam com uma reserva existente.
                </p>
              ) : null}
              <Button className="w-full sm:w-fit" type="submit" disabled={!canBook}>
                <MessageCircle size={18} />
                Solicitar pelo WhatsApp
              </Button>
            </form>

            <aside className="h-fit rounded-md border border-ink/10 bg-[#f7f4ee] p-5 shadow-soft">
              <h3 className="text-2xl font-black">Resumo</h3>
              <div className="mt-5 grid gap-3 text-sm">
                <SummaryRow label="Diarias" value={`${nights} noite(s)`} />
                <SummaryRow label="Valor por diaria" value={currency.format(property.daily_rate)} />
                <SummaryRow label="Limpeza" value={nights > 0 ? currency.format(property.cleaning_fee) : '-'} />
                <div className="mt-3 border-t border-ink/10 pt-4">
                  <SummaryRow label="Total estimado" value={currency.format(total)} strong />
                </div>
              </div>
              <div className="mt-6 rounded-md bg-white p-4 text-sm leading-6 text-ink/70">
                Depois do envio pelo WhatsApp, a reserva fica pendente ate confirmacao do proprietario.
              </div>
              {message ? <p className="mt-4 rounded-md bg-mist px-4 py-3 text-sm font-semibold">{message}</p> : null}
              {lastWhatsAppUrl ? (
                <a
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-leaf px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#285f42]"
                  href={lastWhatsAppUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={18} />
                  Abrir WhatsApp
                </a>
              ) : null}
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
          addPhoto={addPhoto}
          adminUnlocked={adminUnlocked}
          adminSession={adminSession}
          onClose={() => setAdminOpen(false)}
          onUnlock={(pin) => setAdminUnlocked(pin === adminPin)}
          property={property}
          reservations={reservations}
          saveProperty={saveProperty}
          updateReservationStatus={updateReservationStatus}
        />
      ) : null}

      {loading ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#f7f4ee]/90 font-bold">
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
                outsideMonth ? 'bg-[#fbfaf7] text-ink/30' : 'bg-white'
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
  addPhoto,
  adminUnlocked,
  adminSession,
  onClose,
  onUnlock,
  property,
  reservations,
  saveProperty,
  updateReservationStatus,
}) {
  const [pin, setPin] = useState('');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [draft, setDraft] = useState({
    ...property,
    amenities: property.amenities?.join(', ') || '',
    rules: property.rules?.join(', ') || '',
  });
  const [photo, setPhoto] = useState({ url: '', alt: '' });

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

  return (
    <div className="fixed inset-0 z-40 bg-ink/55 p-3 backdrop-blur-sm">
      <div className="ml-auto h-full max-w-2xl overflow-auto rounded-md bg-[#f7f4ee] shadow-soft">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-[#f7f4ee] px-5 py-4">
          <div>
            <h2 className="text-2xl font-black">Administracao</h2>
            <p className="text-sm text-ink/60">Atualize valores, fotos e reservas.</p>
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

              if (hasSupabaseConfig) {
                const { error } = await supabase.auth.signInWithPassword(login);
                if (error) setLoginError('Login nao autorizado. Confira e-mail e senha.');
                return;
              }

              onUnlock(pin);
            }}
          >
            {hasSupabaseConfig ? (
              <>
                <Field label="E-mail do administrador">
                  <TextInput
                    type="email"
                    value={login.email}
                    onChange={(event) => setLogin({ ...login, email: event.target.value })}
                    placeholder="admin@email.com"
                  />
                </Field>
                <Field label="Senha">
                  <TextInput
                    type="password"
                    value={login.password}
                    onChange={(event) => setLogin({ ...login, password: event.target.value })}
                    placeholder="Sua senha"
                  />
                </Field>
              </>
            ) : (
              <Field label="PIN de administrador">
                <TextInput
                  type="password"
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="1234"
                />
              </Field>
            )}
            <Button type="submit">
              <Lock size={18} />
              Entrar
            </Button>
            {loginError ? <p className="text-sm font-semibold text-red-700">{loginError}</p> : null}
            <p className="text-sm leading-6 text-ink/65">
              {hasSupabaseConfig
                ? 'Use um usuario criado no Supabase Auth para administrar o site.'
                : 'Este PIN e apenas para demonstracao local. Em producao, use Supabase Auth com usuario e senha.'}
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
            <form className="grid gap-4" onSubmit={submitProperty}>
              <h3 className="text-xl font-black">Dados da casa</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome">
                  <TextInput value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <Field label="Cidade">
                  <TextInput value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
                </Field>
                <Field label="WhatsApp do proprietario">
                  <TextInput
                    value={draft.owner_whatsapp || ''}
                    onChange={(event) => setDraft({ ...draft, owner_whatsapp: event.target.value })}
                    placeholder="5511999999999"
                  />
                </Field>
                <Field label="Diaria">
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
                <Field label="Hospedes maximos">
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
              </div>
              <Field label="Chamada">
                <TextArea
                  value={draft.headline}
                  onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
                />
              </Field>
              <Field label="Descricao">
                <TextArea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </Field>
              <Field label="Comodidades separadas por virgula">
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
              className="grid gap-4 border-t border-ink/10 pt-8"
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
              <Field label="Descricao da foto">
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

            <section className="border-t border-ink/10 pt-8">
              <h3 className="text-xl font-black">Reservas</h3>
              <div className="mt-4 grid gap-3">
                {reservations.map((reservation) => (
                  <div key={reservation.id} className="rounded-md bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-black">{reservation.guest_name}</p>
                        <p className="text-sm text-ink/65">
                          {reservation.check_in} ate {reservation.check_out} - {reservation.guests} hospede(s)
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {currency.format(reservation.total_amount || 0)} - {reservation.status}
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
                              `Ola, ${reservation.guest_name}. Sua reserva em ${property.name} foi confirmada para ${reservation.check_in} ate ${reservation.check_out}.`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={16} />
                            WhatsApp
                          </a>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={() => updateReservationStatus(reservation.id, 'confirmed')}
                        >
                          <Check size={16} />
                          Confirmar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => updateReservationStatus(reservation.id, 'cancelled')}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
