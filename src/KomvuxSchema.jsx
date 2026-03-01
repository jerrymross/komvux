import React, { useState, useEffect } from 'react';

// ============ UTILITIES ============
const generateId = () => Math.random().toString(36).substr(2, 9);
const WEEKDAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag'];
const WEEKDAY_SHORT = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre'];
const PRESET_COLORS = [
  '#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30',
  '#5AC8FA', '#AF52DE', '#30D158', '#FF6B35', '#64D2FF'
];

const TIME_START = 8;
const TIME_END = 17;
const SLOT_HEIGHT = 60;

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getWeekDates = (date) => {
  const curr = new Date(date);
  const first = curr.getDate() - curr.getDay() + 1;
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(curr);
    d.setDate(first + i);
    return new Date(d);
  });
};

const formatDate = (date) => date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
const formatDateKey = (date) => date.toISOString().split('T')[0];

const timeToPixels = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h - TIME_START) + m / 60) * SLOT_HEIGHT;
};

// Migrate old data format to new
const migrateData = (data) => {
  const classes = (data.classes || []).map(cls => ({
    ...cls,
    coursePlan: cls.coursePlan || (cls.courseIds || []).map(courseId => ({
      courseId, startDate: '', endDate: ''
    })),
    weeklySchedule: cls.weeklySchedule || (cls.scheduledDays || []).map(day => ({
      courseId: cls.courseIds?.[0] || '', day, startTime: '', endTime: ''
    })),
    aplPeriods: cls.aplPeriods || []
  }));
  return { ...data, classes };
};

// Core schedule engine
const getEffectiveScheduleForDate = (date, classes, schedule) => {
  const dateKey = formatDateKey(date);
  const dayIndex = (date.getDay() + 6) % 7;
  if (dayIndex > 4) return [];

  const autoEntries = [];

  for (const cls of classes) {
    const inApl = (cls.aplPeriods || []).some(apl =>
      apl.startDate && apl.endDate &&
      dateKey >= apl.startDate && dateKey <= apl.endDate
    );
    if (inApl) continue;

    const daySlots = (cls.weeklySchedule || []).filter(ws => ws.day === dayIndex);

    for (const slot of daySlots) {
      if (!slot.courseId) continue;
      const plan = (cls.coursePlan || []).find(cp => cp.courseId === slot.courseId);
      const courseActive = plan && (
        (!plan.startDate || dateKey >= plan.startDate) &&
        (!plan.endDate || dateKey <= plan.endDate)
      );

      if (courseActive) {
        autoEntries.push({
          id: `auto-${cls.id}-${slot.courseId}-${slot.day}-${slot.startTime}`,
          classId: cls.id,
          courseId: slot.courseId,
          startTime: slot.startTime || '',
          endTime: slot.endTime || '',
          isAuto: true
        });
      }
    }
  }

  const manualEntries = (schedule[dateKey] || [])
    .filter(e => !e.cancelled)
    .map(entry => ({ ...entry, isAuto: false }));

  const cancellations = (schedule[dateKey] || []).filter(e => e.cancelled);
  const filteredAuto = autoEntries.filter(ae =>
    !cancellations.some(c => c.classId === ae.classId && c.courseId === ae.courseId)
  );

  return [...filteredAuto, ...manualEntries];
};

const getAplForDate = (date, classes) => {
  const dateKey = formatDateKey(date);
  return classes
    .filter(cls => (cls.aplPeriods || []).some(apl =>
      apl.startDate && apl.endDate &&
      dateKey >= apl.startDate && dateKey <= apl.endDate
    ))
    .map(cls => {
      const apl = cls.aplPeriods.find(a =>
        dateKey >= a.startDate && dateKey <= a.endDate
      );
      return { classId: cls.id, className: cls.name, description: apl?.description || '' };
    });
};

// Resolve overlapping time blocks for a day column
const resolveOverlaps = (entries) => {
  const timed = entries.filter(e => e.startTime && e.endTime).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const result = [];
  const groups = [];
  let currentGroup = [];

  for (const entry of timed) {
    if (currentGroup.length === 0 || entry.startTime < currentGroup[currentGroup.length - 1].endTime) {
      currentGroup.push(entry);
    } else {
      groups.push([...currentGroup]);
      currentGroup = [entry];
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  for (const group of groups) {
    group.forEach((entry, idx) => {
      result.push({ ...entry, layoutCol: idx, layoutTotal: group.length });
    });
  }
  return result;
};

// ============ MAIN APP ============
export default function KomvuxSchema() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeView, setActiveView] = useState('today');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [todos, setTodos] = useState({});
  const [notes, setNotes] = useState({});

  const [modal, setModal] = useState({ type: null, data: null });
  const [loaded, setLoaded] = useState(false);

  // Load/Save localStorage
  useEffect(() => {
    const saved = localStorage.getItem('komvux-schema');
    if (saved) {
      const data = migrateData(JSON.parse(saved));
      setCourses(data.courses || []);
      setClasses(data.classes || []);
      setSchedule(data.schedule || {});
      setTodos(data.todos || {});
      setNotes(data.notes || {});
      setDarkMode(data.darkMode || false);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem('komvux-schema', JSON.stringify({ courses, classes, schedule, todos, notes, darkMode }));
  }, [courses, classes, schedule, todos, notes, darkMode, loaded]);

  // Helper functions using new engine
  const getScheduleForDate = (date) => getEffectiveScheduleForDate(date, classes, schedule);
  const getStudentsForDate = (date) => getScheduleForDate(date).reduce((sum, e) => {
    const cls = classes.find(c => c.id === e.classId);
    return sum + (cls?.studentCount || 0);
  }, 0);
  const hasConflict = (date) => {
    const entries = getScheduleForDate(date);
    const timed = entries.filter(e => e.startTime && e.endTime);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        if (timed[i].startTime < timed[j].endTime && timed[j].startTime < timed[i].endTime) return true;
      }
    }
    return false;
  };
  const getLessonCount = (classId) => {
    // Count from weeklySchedule + coursePlan (approximate: count weekly slots × active weeks)
    const cls = classes.find(c => c.id === classId);
    if (!cls) return 0;
    let count = 0;
    for (const slot of (cls.weeklySchedule || [])) {
      const plan = (cls.coursePlan || []).find(cp => cp.courseId === slot.courseId);
      if (plan?.startDate && plan?.endDate) {
        const start = new Date(plan.startDate);
        const end = new Date(plan.endDate);
        const weeks = Math.max(1, Math.ceil((end - start) / (7 * 86400000)));
        count += weeks;
      } else {
        count += 1;
      }
    }
    // Also add manual entries
    count += Object.values(schedule).flat().filter(e => e.classId === classId && !e.cancelled).length;
    return count;
  };

  // Theme — Apple HIG inspired
  const theme = {
    bg: darkMode ? '#000000' : '#f5f5f7',
    bgCard: darkMode ? 'rgba(28, 28, 30, 0.82)' : 'rgba(255, 255, 255, 0.72)',
    bgCardSolid: darkMode ? '#1c1c1e' : '#ffffff',
    bgHover: darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    bgTertiary: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    text: darkMode ? '#f5f5f7' : '#1d1d1f',
    textMuted: darkMode ? '#98989d' : '#86868b',
    border: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
    accent: '#007AFF',
    accentGreen: '#34C759',
    warning: '#FF6B35',
    apl: '#FF9F0A',
    shadow: darkMode ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    shadowMd: darkMode ? '0 4px 16px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.08)',
    shadowLg: darkMode ? '0 12px 40px rgba(0,0,0,0.6)' : '0 12px 40px rgba(0,0,0,0.12)',
    glass: darkMode ? 'saturate(180%) blur(20px)' : 'saturate(180%) blur(20px)',
  };

  const navItems = [
    { id: 'today', label: 'Idag', icon: '◉' },
    { id: 'week', label: 'Vecka', icon: '▤' },
    { id: 'day', label: 'Dag', icon: '▢' },
    { id: 'month', label: 'Månad', icon: '▦' },
    { id: 'manage', label: 'Hantera', icon: '⚙' }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif", WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>
      {/* Header — frosted glass */}
      <header style={{ backgroundColor: theme.bgCard, backdropFilter: theme.glass, WebkitBackdropFilter: theme.glass, borderBottom: `0.5px solid ${theme.border}`, padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #007AFF, #5856D6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '15px' }}>S</div>
            <h1 style={{ fontSize: '18px', fontWeight: '600', letterSpacing: '-0.3px' }}>Komvux Schema</h1>
          </div>

          <nav style={{ display: 'flex', gap: '2px', backgroundColor: theme.bgHover, borderRadius: '10px', padding: '3px' }}>
            {navItems.map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)} style={{
                padding: '7px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: activeView === v.id ? theme.bgCardSolid : 'transparent',
                color: activeView === v.id ? theme.text : theme.textMuted,
                cursor: 'pointer', fontWeight: '500', fontSize: '13px',
                boxShadow: activeView === v.id ? theme.shadow : 'none',
                transition: 'all 0.2s ease', letterSpacing: '-0.1px'
              }}>
                {v.label}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setModal({ type: 'stats' })} style={{ padding: '7px 14px', borderRadius: '100px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s ease' }}>
              Statistik
            </button>
            <button onClick={() => setDarkMode(!darkMode)} style={{ padding: '7px 12px', borderRadius: '100px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s ease' }}>
              {darkMode ? '☀' : '☾'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {activeView === 'today' && (
          <TodayView date={new Date()} schedule={getScheduleForDate(new Date())} classes={classes} courses={courses} todos={todos} setTodos={setTodos} notes={notes} setNotes={setNotes} theme={theme} onAddLesson={() => setModal({ type: 'schedule', data: new Date() })} />
        )}
        {activeView === 'week' && (
          <WeekView currentDate={currentDate} setCurrentDate={setCurrentDate} getScheduleForDate={getScheduleForDate} classes={classes} courses={courses} theme={theme} onDayClick={(d) => { setSelectedDate(d); setActiveView('day'); }} onAddLesson={(d) => setModal({ type: 'schedule', data: d })} />
        )}
        {activeView === 'day' && (
          <DayView date={selectedDate} setDate={setSelectedDate} schedule={getScheduleForDate(selectedDate)} setSchedule={setSchedule} classes={classes} courses={courses} todos={todos} setTodos={setTodos} notes={notes} setNotes={setNotes} theme={theme} onAddLesson={() => setModal({ type: 'schedule', data: selectedDate })} />
        )}
        {activeView === 'month' && (
          <MonthView currentDate={currentDate} setCurrentDate={setCurrentDate} getScheduleForDate={getScheduleForDate} classes={classes} courses={courses} theme={theme} onDayClick={(d) => { setSelectedDate(d); setActiveView('day'); }} />
        )}
        {activeView === 'manage' && (
          <ManageView courses={courses} setCourses={setCourses} classes={classes} setClasses={setClasses} theme={theme} getLessonCount={getLessonCount} setModal={setModal} />
        )}
      </main>

      {/* Modals */}
      {modal.type === 'course' && (
        <CourseModal course={modal.data} classes={classes} theme={theme} onClose={() => setModal({ type: null })} onSave={(c) => {
          if (modal.data) setCourses(prev => prev.map(x => x.id === c.id ? c : x));
          else setCourses(prev => [...prev, { ...c, id: generateId() }]);
          setModal({ type: null });
        }} />
      )}
      {modal.type === 'class' && (
        <ClassModal cls={modal.data} courses={courses} theme={theme} onClose={() => setModal({ type: null })} onSave={(c) => {
          if (modal.data) setClasses(prev => prev.map(x => x.id === c.id ? c : x));
          else setClasses(prev => [...prev, { ...c, id: generateId() }]);
          setModal({ type: null });
        }} />
      )}
      {modal.type === 'schedule' && (
        <ScheduleModal date={modal.data} classes={classes} courses={courses} autoEntries={getScheduleForDate(modal.data).filter(e => e.isAuto)} manualSchedule={schedule} theme={theme} onClose={() => setModal({ type: null })} onSave={(entries) => {
          setSchedule(prev => ({ ...prev, [formatDateKey(modal.data)]: entries }));
          setModal({ type: null });
        }} />
      )}
      {modal.type === 'stats' && (
        <StatsModal schedule={schedule} classes={classes} courses={courses} getLessonCount={getLessonCount} theme={theme} onClose={() => setModal({ type: null })} />
      )}
    </div>
  );
}

// ============ TODAY VIEW ============
function TodayView({ date, schedule, classes, courses, todos, setTodos, notes, setNotes, theme, onAddLesson }) {
  const dateKey = formatDateKey(date);
  const totalStudents = schedule.reduce((sum, e) => sum + (classes.find(c => c.id === e.classId)?.studentCount || 0), 0);
  const aplToday = getAplForDate(date, classes);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)', borderRadius: '20px', padding: '36px', color: 'white', marginBottom: '28px', boxShadow: '0 8px 30px rgba(0, 122, 255, 0.25)' }}>
        <p style={{ opacity: 0.7, textTransform: 'capitalize', fontSize: '15px', fontWeight: '400', letterSpacing: '0.3px' }}>{date.toLocaleDateString('sv-SE', { weekday: 'long' })}</p>
        <h2 style={{ fontSize: '34px', fontWeight: '700', margin: '6px 0 20px', letterSpacing: '-0.5px' }}>{date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div><p style={{ opacity: 0.65, fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Lektioner</p><p style={{ fontSize: '28px', fontWeight: '700', marginTop: '2px' }}>{schedule.length}</p></div>
          <div><p style={{ opacity: 0.65, fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Elever</p><p style={{ fontSize: '28px', fontWeight: '700', marginTop: '2px' }}>{totalStudents}</p></div>
        </div>
      </div>

      {aplToday.length > 0 && <AplBanner aplClasses={aplToday} theme={theme} />}

      {schedule.length === 0 && aplToday.length === 0 ? (
        <EmptyState theme={theme} message="Inga lektioner idag" onAdd={onAddLesson} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {schedule.map(entry => (
            <LessonCard key={entry.id} entry={entry} dateKey={dateKey} classes={classes} courses={courses} todos={todos} setTodos={setTodos} notes={notes} setNotes={setNotes} theme={theme} />
          ))}
          <AddButton theme={theme} onClick={onAddLesson} />
        </div>
      )}
    </div>
  );
}

// ============ WEEK VIEW (TIDSGRID) ============
function WeekView({ currentDate, setCurrentDate, getScheduleForDate, classes, courses, theme, onDayClick, onAddLesson }) {
  const weekDates = getWeekDates(currentDate);
  const weekNum = getWeekNumber(currentDate);
  const totalHours = TIME_END - TIME_START;

  const navigate = (dir) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const weekData = weekDates.map((date) => ({
    date,
    entries: getScheduleForDate(date),
    aplClasses: getAplForDate(date, classes)
  }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <NavButton theme={theme} onClick={() => navigate(-1)}>← Förra</NavButton>
        <h2 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>Vecka {weekNum}</h2>
        <NavButton theme={theme} onClick={() => navigate(1)}>Nästa →</NavButton>
      </div>

      <div style={{ backgroundColor: theme.bgCardSolid, borderRadius: '20px', boxShadow: theme.shadowMd, overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(5, 1fr)', borderBottom: `0.5px solid ${theme.border}` }}>
          <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: '11px', color: theme.textMuted }} />
          {weekDates.map((date, idx) => {
            const isToday = formatDateKey(date) === formatDateKey(new Date());
            return (
              <div key={idx} onClick={() => onDayClick(date)} style={{
                padding: '14px 8px', textAlign: 'center', cursor: 'pointer',
                borderLeft: `0.5px solid ${theme.border}`,
                backgroundColor: 'transparent'
              }}>
                <p style={{ fontWeight: '600', fontSize: '13px', color: isToday ? theme.accent : theme.textMuted, letterSpacing: '-0.1px' }}>{WEEKDAYS[idx]}</p>
                <p style={{ fontSize: '22px', fontWeight: isToday ? '700' : '300', color: isToday ? theme.accent : theme.text, marginTop: '2px', letterSpacing: '-0.5px' }}>{date.getDate()}</p>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(5, 1fr)', position: 'relative' }}>
          {/* Time labels */}
          <div style={{ position: 'relative' }}>
            {Array.from({ length: totalHours }, (_, i) => (
              <div key={i} style={{
                height: SLOT_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                paddingTop: '0px', paddingRight: '10px', fontSize: '11px', color: theme.textMuted, fontWeight: '400',
                borderTop: `0.5px solid ${theme.border}`, marginTop: '-6px', letterSpacing: '0.2px'
              }}>
                {String(TIME_START + i).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekData.map((day, dayIdx) => {
            const isToday = formatDateKey(day.date) === formatDateKey(new Date());
            const timedEntries = resolveOverlaps(day.entries);
            const untimedEntries = day.entries.filter(e => !e.startTime || !e.endTime);

            return (
              <div key={dayIdx} style={{
                position: 'relative', borderLeft: `0.5px solid ${theme.border}`,
                height: totalHours * SLOT_HEIGHT,
                backgroundColor: isToday ? `${theme.accent}06` : 'transparent'
              }}>
                {/* Hour grid lines */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: i * SLOT_HEIGHT, width: '100%',
                    borderTop: `0.5px solid ${theme.border}`, height: SLOT_HEIGHT
                  }} />
                ))}

                {/* APL overlay */}
                {day.aplClasses.map(apl => (
                  <div key={apl.classId} style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: `${theme.apl}0a`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 5, pointerEvents: 'none',
                    flexDirection: 'column', gap: '4px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: theme.apl, backgroundColor: `${theme.apl}18`, padding: '5px 12px', borderRadius: '100px', letterSpacing: '0.5px' }}>
                      APL
                    </span>
                    <span style={{ fontSize: '10px', color: theme.apl, opacity: 0.8 }}>{apl.className}</span>
                  </div>
                ))}

                {/* Timed lesson blocks */}
                {timedEntries.map(entry => {
                  const course = courses.find(c => c.id === entry.courseId);
                  const cls = classes.find(c => c.id === entry.classId);
                  if (!course && !cls) return null;
                  const top = timeToPixels(entry.startTime);
                  const height = Math.max(timeToPixels(entry.endTime) - top, 24);
                  const colWidth = 100 / entry.layoutTotal;
                  const leftPct = entry.layoutCol * colWidth;

                  return (
                    <div key={entry.id} onClick={(e) => { e.stopPropagation(); onDayClick(day.date); }} style={{
                      position: 'absolute', top: top + 1, left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${colWidth}% - 4px)`, height: height - 2,
                      backgroundColor: course?.color || theme.accent, color: 'white',
                      borderRadius: '8px', padding: '5px 7px', overflow: 'hidden',
                      fontSize: '11px', cursor: 'pointer', zIndex: 10,
                      display: 'flex', flexDirection: 'column', lineHeight: '1.3',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}>
                      <span style={{ fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cls?.name || 'Okänd'}</span>
                      {height > 36 && <span style={{ opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course?.name || ''}</span>}
                      {height > 50 && <span style={{ opacity: 0.7 }}>{entry.startTime}–{entry.endTime}</span>}
                    </div>
                  );
                })}

                {/* Untimed entries stacked at bottom */}
                {untimedEntries.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2px', display: 'flex', flexDirection: 'column', gap: '2px', zIndex: 10 }}>
                    {untimedEntries.map(entry => {
                      const course = courses.find(c => c.id === entry.courseId);
                      const cls = classes.find(c => c.id === entry.classId);
                      return (
                        <div key={entry.id} style={{
                          padding: '3px 6px', borderRadius: '4px',
                          backgroundColor: course?.color || theme.accent,
                          color: 'white', fontSize: '10px', fontWeight: '500',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {cls?.name || 'Okänd'}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add button */}
                <button onClick={(e) => { e.stopPropagation(); onAddLesson(day.date); }} style={{
                  position: 'absolute', bottom: '4px', right: '4px',
                  width: '22px', height: '22px', borderRadius: '50%',
                  border: 'none', backgroundColor: theme.bgCard,
                  color: theme.accent, cursor: 'pointer', fontSize: '15px', fontWeight: '300',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 15,
                  boxShadow: theme.shadow, transition: 'all 0.2s ease', opacity: 0.7
                }}>+</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ DAY VIEW ============
function DayView({ date, setDate, schedule, setSchedule, classes, courses, todos, setTodos, notes, setNotes, theme, onAddLesson }) {
  const dateKey = formatDateKey(date);
  const aplToday = getAplForDate(date, classes);

  const navigate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d);
  };

  const removeLesson = (entry) => {
    if (entry.isAuto) {
      // Cancel an auto-generated lesson
      setSchedule(prev => ({
        ...prev,
        [dateKey]: [...(prev[dateKey] || []), { id: generateId(), classId: entry.classId, courseId: entry.courseId, cancelled: true }]
      }));
    } else {
      setSchedule(prev => ({
        ...prev,
        [dateKey]: (prev[dateKey] || []).filter(e => e.id !== entry.id)
      }));
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <NavButton theme={theme} onClick={() => navigate(-1)}>←</NavButton>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', textTransform: 'capitalize', letterSpacing: '-0.5px' }}>{date.toLocaleDateString('sv-SE', { weekday: 'long' })}</h2>
          <p style={{ color: theme.textMuted, fontSize: '14px', marginTop: '2px' }}>{date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}</p>
        </div>
        <NavButton theme={theme} onClick={() => navigate(1)}>→</NavButton>
      </div>

      {aplToday.length > 0 && <AplBanner aplClasses={aplToday} theme={theme} />}

      {schedule.length === 0 && aplToday.length === 0 ? (
        <EmptyState theme={theme} message="Inga lektioner denna dag" onAdd={onAddLesson} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {schedule.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map(entry => (
            <LessonCard key={entry.id} entry={entry} dateKey={dateKey} classes={classes} courses={courses} todos={todos} setTodos={setTodos} notes={notes} setNotes={setNotes} theme={theme} onRemove={() => removeLesson(entry)} />
          ))}
          <AddButton theme={theme} onClick={onAddLesson} />
        </div>
      )}
    </div>
  );
}

// ============ MONTH VIEW ============
function MonthView({ currentDate, setCurrentDate, getScheduleForDate, classes, courses, theme, onDayClick }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;

  const days = [...Array(startOffset).fill(null), ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1))];

  const navigate = (dir) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <NavButton theme={theme} onClick={() => navigate(-1)}>←</NavButton>
        <h2 style={{ fontSize: '24px', fontWeight: '700', textTransform: 'capitalize', letterSpacing: '-0.5px' }}>{currentDate.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })}</h2>
        <NavButton theme={theme} onClick={() => navigate(1)}>→</NavButton>
      </div>

      <div style={{ backgroundColor: theme.bgCardSolid, borderRadius: '20px', padding: '20px', boxShadow: theme.shadowMd }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '12px' }}>
          {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px', fontWeight: '500', color: theme.textMuted, fontSize: '11px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {days.map((date, idx) => {
            if (!date) return <div key={idx} />;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = formatDateKey(date) === formatDateKey(new Date());
            const daySchedule = getScheduleForDate(date);
            const aplClasses = getAplForDate(date, classes);

            return (
              <div key={idx} onClick={() => !isWeekend && onDayClick(date)} style={{
                padding: '8px', borderRadius: '12px', minHeight: '70px', cursor: isWeekend ? 'default' : 'pointer',
                backgroundColor: isToday ? theme.accent : aplClasses.length > 0 ? `${theme.apl}08` : 'transparent',
                color: isToday ? 'white' : isWeekend ? theme.textMuted : theme.text,
                opacity: isWeekend ? 0.4 : 1, transition: 'background-color 0.15s ease'
              }}>
                <div style={{ fontWeight: isToday ? '700' : '400', marginBottom: '4px', fontSize: '15px' }}>{date.getDate()}</div>
                {aplClasses.length > 0 && !isWeekend && (
                  <div style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: theme.apl, marginBottom: '2px', border: `1px dashed ${theme.apl}` }} />
                )}
                {!isWeekend && daySchedule.slice(0, 2).map(entry => {
                  const course = courses.find(c => c.id === entry.courseId);
                  const cls = classes.find(c => c.id === entry.classId);
                  const fallbackCourse = !course && cls ? courses.find(c => cls.courseIds?.includes(c.id)) : null;
                  return <div key={entry.id} style={{ width: '100%', height: '4px', borderRadius: '2px', backgroundColor: isToday ? 'rgba(255,255,255,0.5)' : ((course || fallbackCourse)?.color || theme.accent), marginBottom: '2px' }} />;
                })}
                {daySchedule.length > 2 && <span style={{ fontSize: '10px', color: isToday ? 'rgba(255,255,255,0.8)' : theme.textMuted }}>+{daySchedule.length - 2}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ MANAGE VIEW ============
function ManageView({ courses, setCourses, classes, setClasses, theme, getLessonCount, setModal }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      <Section title="Kurser" theme={theme} onAdd={() => setModal({ type: 'course' })}>
        {courses.length === 0 ? <p style={{ color: theme.textMuted, textAlign: 'center', padding: '24px' }}>Inga kurser ännu</p> : (
          courses.map(course => (
            <ItemCard key={course.id} theme={theme} color={course.color} title={course.name} subtitle={`${course.studentCount || 0} elever`}
              onEdit={() => setModal({ type: 'course', data: course })}
              onDelete={() => { if (window.confirm('Ta bort kursen?')) setCourses(prev => prev.filter(c => c.id !== course.id)); }}
            />
          ))
        )}
      </Section>
      <Section title="Klasser" theme={theme} onAdd={() => setModal({ type: 'class' })}>
        {classes.length === 0 ? <p style={{ color: theme.textMuted, textAlign: 'center', padding: '24px' }}>Inga klasser ännu</p> : (
          classes.map(cls => {
            const activeCourses = (cls.coursePlan || []).filter(cp => {
              const today = formatDateKey(new Date());
              return (!cp.startDate || today >= cp.startDate) && (!cp.endDate || today <= cp.endDate);
            });
            const weeklySlots = (cls.weeklySchedule || []).length;
            const aplCount = (cls.aplPeriods || []).length;

            return (
              <ItemCard key={cls.id} theme={theme} title={cls.name}
                subtitle={`${cls.studentCount || 0} elever • ${weeklySlots} lektioner/vecka • ~${getLessonCount(cls.id)} totalt`}
                extra={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    {activeCourses.length > 0 && (
                      <p style={{ fontSize: '11px', color: theme.accent }}>
                        {activeCourses.length} aktiva kurser
                      </p>
                    )}
                    {aplCount > 0 && (
                      <p style={{ fontSize: '11px', color: theme.apl }}>
                        {aplCount} APL-period{aplCount > 1 ? 'er' : ''}
                      </p>
                    )}
                    {cls.weeklySchedule?.length > 0 && (
                      <p style={{ fontSize: '11px', color: theme.textMuted }}>
                        {[...new Set(cls.weeklySchedule.map(ws => ws.day))].sort().map(d => WEEKDAY_SHORT[d]).join(', ')}
                      </p>
                    )}
                  </div>
                }
                tags={courses.filter(c => cls.courseIds?.includes(c.id)).map(c => ({ name: c.name, color: c.color }))}
                onEdit={() => setModal({ type: 'class', data: cls })}
                onDelete={() => { if (window.confirm('Ta bort klassen?')) setClasses(prev => prev.filter(c => c.id !== cls.id)); }}
              />
            );
          })
        )}
      </Section>
    </div>
  );
}

// ============ MODALS ============
function Modal({ children, theme, onClose, width = 420 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ backgroundColor: theme.bgCardSolid, borderRadius: '20px', padding: '28px', width, maxHeight: '90vh', overflow: 'auto', boxShadow: theme.shadowLg, border: `0.5px solid ${theme.border}` }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function CourseModal({ course, classes, theme, onClose, onSave }) {
  const [form, setForm] = useState({ name: course?.name || '', color: course?.color || PRESET_COLORS[0], studentCount: course?.studentCount || 0, notes: course?.notes || '', linkedClassId: course?.linkedClassId || '' });

  return (
    <Modal theme={theme} onClose={onClose}>
      <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px', letterSpacing: '-0.3px' }}>{course ? 'Redigera kurs' : 'Ny kurs'}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input label="Kursnamn" value={form.name} onChange={v => setForm({ ...form, name: v })} theme={theme} placeholder="t.ex. Svenska 1" />
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '500', color: theme.textMuted }}>Färg</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: c, border: form.color === c ? '2.5px solid white' : 'none', cursor: 'pointer', boxShadow: form.color === c ? `0 0 0 2px ${c}` : '0 1px 3px rgba(0,0,0,0.1)', transition: 'transform 0.15s ease' }} />
            ))}
          </div>
        </div>
        <Input label="Antal elever" type="number" value={form.studentCount} onChange={v => setForm({ ...form, studentCount: parseInt(v) || 0 })} theme={theme} />
        <Textarea label="Anteckningar" value={form.notes} onChange={v => setForm({ ...form, notes: v })} theme={theme} placeholder="Valfria anteckningar..." />
      </div>
      <ModalButtons theme={theme} onClose={onClose} onSave={() => form.name.trim() && onSave({ ...course, ...form })} />
    </Modal>
  );
}

// ============ CLASS MODAL WITH TABS ============
function ClassModal({ cls, courses, theme, onClose, onSave }) {
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState({
    name: cls?.name || '',
    studentCount: cls?.studentCount || 0,
    notes: cls?.notes || '',
    coursePlan: cls?.coursePlan || [],
    weeklySchedule: cls?.weeklySchedule || [],
    aplPeriods: cls?.aplPeriods || [],
  });

  const handleSave = () => {
    if (!form.name.trim()) return;
    const derived = {
      ...form,
      courseIds: [...new Set(form.coursePlan.map(cp => cp.courseId).filter(Boolean))],
      scheduledDays: [...new Set(form.weeklySchedule.map(ws => ws.day))].sort()
    };
    onSave({ ...cls, ...derived });
  };

  const tabs = [
    { id: 'info', label: 'Grundinfo' },
    { id: 'plan', label: 'Utbildningsplan' },
    { id: 'weekly', label: 'Veckoschema' },
    { id: 'apl', label: 'APL' },
  ];

  const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, fontSize: '13px', outline: 'none' };

  return (
    <Modal theme={theme} onClose={onClose} width={640}>
      <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', letterSpacing: '-0.3px' }}>{cls ? 'Redigera klass' : 'Ny klass'}</h3>

      {/* Tab bar — segmented control */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '24px', backgroundColor: theme.bgHover, borderRadius: '10px', padding: '3px' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '7px 10px', borderRadius: '8px', border: 'none',
            backgroundColor: tab === t.id ? theme.bgCardSolid : 'transparent',
            color: tab === t.id ? theme.text : theme.textMuted,
            cursor: 'pointer', fontWeight: '500', fontSize: '12px',
            boxShadow: tab === t.id ? theme.shadow : 'none',
            transition: 'all 0.2s ease'
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Grundinfo */}
      {tab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Klassnamn" value={form.name} onChange={v => setForm({ ...form, name: v })} theme={theme} placeholder="t.ex. Grupp A" />
          <Input label="Antal elever" type="number" value={form.studentCount} onChange={v => setForm({ ...form, studentCount: parseInt(v) || 0 })} theme={theme} />
          <Textarea label="Anteckningar" value={form.notes} onChange={v => setForm({ ...form, notes: v })} theme={theme} placeholder="Valfria anteckningar..." />
        </div>
      )}

      {/* Tab: Utbildningsplan */}
      {tab === 'plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: theme.textMuted }}>Ange vilka kurser som körs och deras start- och slutdatum.</p>

          {form.coursePlan.length === 0 && (
            <p style={{ color: theme.textMuted, textAlign: 'center', padding: '16px', fontSize: '14px' }}>Inga kurser tillagda</p>
          )}

          {form.coursePlan.map((cp, idx) => {
            const course = courses.find(c => c.id === cp.courseId);
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 32px', gap: '8px', alignItems: 'center' }}>
                <select value={cp.courseId} onChange={e => {
                  const updated = [...form.coursePlan];
                  updated[idx] = { ...updated[idx], courseId: e.target.value };
                  setForm({ ...form, coursePlan: updated });
                }} style={{ ...inputStyle }}>
                  <option value="">Välj kurs...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={cp.startDate || ''} onChange={e => {
                  const updated = [...form.coursePlan];
                  updated[idx] = { ...updated[idx], startDate: e.target.value };
                  setForm({ ...form, coursePlan: updated });
                }} style={inputStyle} />
                <input type="date" value={cp.endDate || ''} onChange={e => {
                  const updated = [...form.coursePlan];
                  updated[idx] = { ...updated[idx], endDate: e.target.value };
                  setForm({ ...form, coursePlan: updated });
                }} style={inputStyle} />
                <button onClick={() => setForm({ ...form, coursePlan: form.coursePlan.filter((_, i) => i !== idx) })} style={{
                  padding: '6px', border: 'none', backgroundColor: `${theme.warning}20`, color: theme.warning,
                  borderRadius: '8px', cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s ease'
                }}>×</button>
              </div>
            );
          })}

          {/* Header row labels */}
          {form.coursePlan.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 32px', gap: '8px', fontSize: '11px', color: theme.textMuted, marginTop: '-8px', marginBottom: '-4px' }}>
              <span>Kurs</span><span>Startdatum</span><span>Slutdatum</span><span />
            </div>
          )}

          <button onClick={() => setForm({ ...form, coursePlan: [...form.coursePlan, { courseId: '', startDate: '', endDate: '' }] })} style={{
            padding: '10px', borderRadius: '10px', border: 'none',
            backgroundColor: theme.bgHover, color: theme.accent, cursor: 'pointer', fontWeight: '500', fontSize: '13px', transition: 'all 0.15s ease'
          }}>
            + Lägg till kurs
          </button>
        </div>
      )}

      {/* Tab: Veckoschema */}
      {tab === 'weekly' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: theme.textMuted }}>Definiera fasta lektioner per veckodag. Dessa repeteras automatiskt under kursens aktiva period.</p>

          {form.weeklySchedule.length === 0 && (
            <p style={{ color: theme.textMuted, textAlign: 'center', padding: '16px', fontSize: '14px' }}>Inga lektioner i veckoschemat</p>
          )}

          {form.weeklySchedule.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 32px', gap: '8px', fontSize: '11px', color: theme.textMuted }}>
              <span>Kurs</span><span>Dag</span><span>Start</span><span>Slut</span><span />
            </div>
          )}

          {form.weeklySchedule.map((ws, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 32px', gap: '8px', alignItems: 'center' }}>
              <select value={ws.courseId} onChange={e => {
                const updated = [...form.weeklySchedule];
                updated[idx] = { ...updated[idx], courseId: e.target.value };
                setForm({ ...form, weeklySchedule: updated });
              }} style={inputStyle}>
                <option value="">Välj kurs...</option>
                {courses.filter(c => form.coursePlan.some(cp => cp.courseId === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {courses.filter(c => !form.coursePlan.some(cp => cp.courseId === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.name} (ej i plan)</option>
                ))}
              </select>
              <select value={ws.day} onChange={e => {
                const updated = [...form.weeklySchedule];
                updated[idx] = { ...updated[idx], day: parseInt(e.target.value) };
                setForm({ ...form, weeklySchedule: updated });
              }} style={inputStyle}>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{WEEKDAY_SHORT[i]}</option>)}
              </select>
              <input type="time" value={ws.startTime || ''} onChange={e => {
                const updated = [...form.weeklySchedule];
                updated[idx] = { ...updated[idx], startTime: e.target.value };
                setForm({ ...form, weeklySchedule: updated });
              }} style={inputStyle} />
              <input type="time" value={ws.endTime || ''} onChange={e => {
                const updated = [...form.weeklySchedule];
                updated[idx] = { ...updated[idx], endTime: e.target.value };
                setForm({ ...form, weeklySchedule: updated });
              }} style={inputStyle} />
              <button onClick={() => setForm({ ...form, weeklySchedule: form.weeklySchedule.filter((_, i) => i !== idx) })} style={{
                padding: '6px', border: 'none', backgroundColor: theme.warning, color: 'white',
                borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
              }}>×</button>
            </div>
          ))}

          <button onClick={() => setForm({ ...form, weeklySchedule: [...form.weeklySchedule, { courseId: '', day: 0, startTime: '08:00', endTime: '10:00' }] })} style={{
            padding: '10px', borderRadius: '10px', border: 'none',
            backgroundColor: theme.bgHover, color: theme.accent, cursor: 'pointer', fontWeight: '500', fontSize: '13px', transition: 'all 0.15s ease'
          }}>
            + Lägg till lektion
          </button>
        </div>
      )}

      {/* Tab: APL */}
      {tab === 'apl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: theme.textMuted }}>Under APL-perioder visas inga vanliga lektioner för klassen.</p>

          {form.aplPeriods.length === 0 && (
            <p style={{ color: theme.textMuted, textAlign: 'center', padding: '16px', fontSize: '14px' }}>Inga APL-perioder tillagda</p>
          )}

          {form.aplPeriods.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '130px 130px 1fr 32px', gap: '8px', fontSize: '11px', color: theme.textMuted }}>
              <span>Startdatum</span><span>Slutdatum</span><span>Beskrivning</span><span />
            </div>
          )}

          {form.aplPeriods.map((apl, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '130px 130px 1fr 32px', gap: '8px', alignItems: 'center' }}>
              <input type="date" value={apl.startDate || ''} onChange={e => {
                const updated = [...form.aplPeriods];
                updated[idx] = { ...updated[idx], startDate: e.target.value };
                setForm({ ...form, aplPeriods: updated });
              }} style={inputStyle} />
              <input type="date" value={apl.endDate || ''} onChange={e => {
                const updated = [...form.aplPeriods];
                updated[idx] = { ...updated[idx], endDate: e.target.value };
                setForm({ ...form, aplPeriods: updated });
              }} style={inputStyle} />
              <input type="text" value={apl.description || ''} onChange={e => {
                const updated = [...form.aplPeriods];
                updated[idx] = { ...updated[idx], description: e.target.value };
                setForm({ ...form, aplPeriods: updated });
              }} style={inputStyle} placeholder="t.ex. APL period 1" />
              <button onClick={() => setForm({ ...form, aplPeriods: form.aplPeriods.filter((_, i) => i !== idx) })} style={{
                padding: '6px', border: 'none', backgroundColor: theme.warning, color: 'white',
                borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
              }}>×</button>
            </div>
          ))}

          <button onClick={() => setForm({ ...form, aplPeriods: [...form.aplPeriods, { startDate: '', endDate: '', description: '' }] })} style={{
            padding: '10px', borderRadius: '10px', border: 'none',
            backgroundColor: theme.bgHover, color: theme.accent, cursor: 'pointer', fontWeight: '500', fontSize: '13px', transition: 'all 0.15s ease'
          }}>
            + Lägg till APL-period
          </button>
        </div>
      )}

      <ModalButtons theme={theme} onClose={onClose} onSave={handleSave} />
    </Modal>
  );
}

// ============ SCHEDULE MODAL ============
function ScheduleModal({ date, classes, courses, autoEntries, manualSchedule, theme, onClose, onSave }) {
  const dateKey = formatDateKey(date);
  const existingManual = (manualSchedule[dateKey] || []).filter(e => !e.cancelled);
  const existingCancellations = (manualSchedule[dateKey] || []).filter(e => e.cancelled);

  const [manualEntries, setManualEntries] = useState(existingManual);
  const [cancellations, setCancellations] = useState(existingCancellations);
  const [newEntry, setNewEntry] = useState({ classId: '', courseId: '', startTime: '', endTime: '' });

  const cancelAutoLesson = (entry) => {
    setCancellations(prev => [...prev, { id: generateId(), classId: entry.classId, courseId: entry.courseId, cancelled: true }]);
  };

  const restoreAutoLesson = (entry) => {
    setCancellations(prev => prev.filter(c => !(c.classId === entry.classId && c.courseId === entry.courseId)));
  };

  const addManual = () => {
    if (!newEntry.classId) return;
    setManualEntries(prev => [...prev, { id: generateId(), ...newEntry }]);
    setNewEntry({ classId: '', courseId: '', startTime: '', endTime: '' });
  };

  const removeManual = (id) => {
    setManualEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleSave = () => {
    onSave([...manualEntries, ...cancellations]);
  };

  const visibleAuto = autoEntries.filter(ae =>
    !cancellations.some(c => c.classId === ae.classId && c.courseId === ae.courseId)
  );
  const cancelledAuto = autoEntries.filter(ae =>
    cancellations.some(c => c.classId === ae.classId && c.courseId === ae.courseId)
  );

  const inputStyle = { padding: '8px 12px', borderRadius: '8px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, fontSize: '13px', outline: 'none' };

  const selectedClass = classes.find(c => c.id === newEntry.classId);

  return (
    <Modal theme={theme} onClose={onClose} width={560}>
      <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', letterSpacing: '-0.3px' }}>Schema för dag</h3>
      <p style={{ color: theme.textMuted, marginBottom: '20px', textTransform: 'capitalize' }}>{date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

      {/* Auto-generated lessons */}
      {(visibleAuto.length > 0 || cancelledAuto.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '10px', fontWeight: '500', letterSpacing: '0.3px' }}>AUTOMATISKA LEKTIONER</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {visibleAuto.map(entry => {
              const cls = classes.find(c => c.id === entry.classId);
              const course = courses.find(c => c.id === entry.courseId);
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', backgroundColor: `${course?.color || theme.accent}0a`, borderLeft: `3px solid ${course?.color || theme.accent}` }}>
                  <div>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{cls?.name}</span>
                    <span style={{ color: theme.textMuted, fontSize: '13px' }}> — {course?.name}</span>
                    {entry.startTime && <span style={{ color: theme.textMuted, fontSize: '12px' }}> ({entry.startTime}–{entry.endTime})</span>}
                  </div>
                  <button onClick={() => cancelAutoLesson(entry)} style={{ padding: '4px 12px', borderRadius: '100px', border: 'none', backgroundColor: `${theme.warning}15`, color: theme.warning, cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.15s ease' }}>
                    Avboka
                  </button>
                </div>
              );
            })}
            {cancelledAuto.map(entry => {
              const cls = classes.find(c => c.id === entry.classId);
              const course = courses.find(c => c.id === entry.courseId);
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', backgroundColor: theme.bgHover, opacity: 0.5, textDecoration: 'line-through' }}>
                  <div>
                    <span style={{ fontSize: '14px' }}>{cls?.name} — {course?.name}</span>
                  </div>
                  <button onClick={() => restoreAutoLesson(entry)} style={{ padding: '4px 12px', borderRadius: '100px', border: 'none', backgroundColor: `${theme.accent}15`, color: theme.accent, cursor: 'pointer', fontSize: '12px', fontWeight: '500', textDecoration: 'none', transition: 'all 0.15s ease' }}>
                    Återställ
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual entries */}
      {manualEntries.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '10px', fontWeight: '500', letterSpacing: '0.3px' }}>MANUELLA LEKTIONER</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {manualEntries.map(entry => {
              const cls = classes.find(c => c.id === entry.classId);
              const course = courses.find(c => c.id === entry.courseId);
              return (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', backgroundColor: theme.bgHover }}>
                  <div>
                    <span style={{ fontWeight: '500', fontSize: '14px' }}>{cls?.name || 'Okänd'}</span>
                    {course && <span style={{ color: theme.textMuted, fontSize: '13px' }}> — {course.name}</span>}
                    {entry.startTime && <span style={{ color: theme.textMuted, fontSize: '12px' }}> ({entry.startTime}–{entry.endTime})</span>}
                  </div>
                  <button onClick={() => removeManual(entry.id)} style={{ padding: '4px 8px', border: 'none', backgroundColor: `${theme.warning}20`, color: theme.warning, borderRadius: '100px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s ease' }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add manual lesson */}
      <div>
        <p style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '10px', fontWeight: '500', letterSpacing: '0.3px' }}>LÄGG TILL EXTRA LEKTION</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <select value={newEntry.classId} onChange={e => setNewEntry({ ...newEntry, classId: e.target.value, courseId: '' })} style={inputStyle}>
            <option value="">Välj klass...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={newEntry.courseId} onChange={e => setNewEntry({ ...newEntry, courseId: e.target.value })} style={inputStyle}>
            <option value="">Välj kurs...</option>
            {selectedClass && courses.filter(c => selectedClass.courseIds?.includes(c.id)).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '8px' }}>
          <input type="time" value={newEntry.startTime} onChange={e => setNewEntry({ ...newEntry, startTime: e.target.value })} style={inputStyle} placeholder="Start" />
          <input type="time" value={newEntry.endTime} onChange={e => setNewEntry({ ...newEntry, endTime: e.target.value })} style={inputStyle} placeholder="Slut" />
          <button onClick={addManual} style={{ padding: '8px', borderRadius: '10px', border: 'none', backgroundColor: theme.accent, color: 'white', cursor: 'pointer', fontWeight: '500', transition: 'all 0.15s ease' }}>+</button>
        </div>
      </div>

      <ModalButtons theme={theme} onClose={onClose} onSave={handleSave} />
    </Modal>
  );
}

function StatsModal({ schedule, classes, courses, getLessonCount, theme, onClose }) {
  const totalLessons = classes.reduce((sum, cls) => sum + getLessonCount(cls.id), 0);
  const maxCount = Math.max(...classes.map(c => getLessonCount(c.id)), 1);

  return (
    <Modal theme={theme} onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' }}>Statistik</h3>
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: theme.bgHover, color: theme.textMuted, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>×</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
        <div style={{ padding: '18px', borderRadius: '16px', backgroundColor: theme.bgHover }}>
          <p style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '6px', fontWeight: '500', letterSpacing: '0.3px' }}>TOTALT LEKTIONER (ca)</p>
          <p style={{ fontSize: '30px', fontWeight: '700', letterSpacing: '-0.5px' }}>{totalLessons}</p>
        </div>
        <div style={{ padding: '18px', borderRadius: '16px', backgroundColor: theme.bgHover }}>
          <p style={{ color: theme.textMuted, fontSize: '11px', marginBottom: '6px', fontWeight: '500', letterSpacing: '0.3px' }}>KURSER / KLASSER</p>
          <p style={{ fontSize: '30px', fontWeight: '700', letterSpacing: '-0.5px' }}>{courses.length} / {classes.length}</p>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontWeight: '600', marginBottom: '14px', fontSize: '15px', letterSpacing: '-0.1px' }}>Lektioner per klass</h4>
        {classes.length === 0 ? <p style={{ color: theme.textMuted }}>Inga klasser</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {classes.map(cls => {
              const count = getLessonCount(cls.id);
              const course = courses.find(c => cls.courseIds?.includes(c.id));
              return (
                <div key={cls.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>{cls.name}</span>
                    <span style={{ fontWeight: '600' }}>~{count}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: theme.bgHover, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, backgroundColor: course?.color || theme.accent, borderRadius: '3px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={() => window.print()} style={{ width: '100%', padding: '12px', borderRadius: '100px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, cursor: 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s ease' }}>
        Exportera / Skriv ut
      </button>
    </Modal>
  );
}

// ============ SHARED COMPONENTS ============
function LessonCard({ entry, dateKey, classes, courses, todos, setTodos, notes, setNotes, theme, onRemove }) {
  const cls = classes.find(c => c.id === entry.classId);
  const course = entry.courseId
    ? courses.find(c => c.id === entry.courseId)
    : courses.find(c => cls?.courseIds?.includes(c.id));
  const key = `${dateKey}-${entry.id}`;
  const entryTodos = todos[key] || [];
  const entryNotes = notes[key] || '';

  const addTodo = (text) => setTodos(prev => ({ ...prev, [key]: [...(prev[key] || []), { text, done: false }] }));
  const toggleTodo = (idx) => setTodos(prev => ({ ...prev, [key]: prev[key].map((t, i) => i === idx ? { ...t, done: !t.done } : t) }));
  const removeTodo = (idx) => setTodos(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));

  return (
    <div style={{ backgroundColor: theme.bgCardSolid, borderRadius: '16px', padding: '20px', boxShadow: theme.shadow, borderLeft: `3px solid ${course?.color || theme.accent}`, transition: 'box-shadow 0.2s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: '600', letterSpacing: '-0.2px' }}>{cls?.name || 'Okänd klass'}</h3>
          <p style={{ color: theme.textMuted, fontSize: '13px', marginTop: '2px' }}>
            {course?.name || 'Ingen kurs'} • {cls?.studentCount || 0} elever
            {entry.startTime && ` • ${entry.startTime}–${entry.endTime}`}
          </p>
          {entry.isAuto && <span style={{ fontSize: '10px', color: theme.accent, fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>AUTO</span>}
        </div>
        {onRemove && <button onClick={onRemove} style={{ padding: '4px 8px', borderRadius: '100px', border: 'none', backgroundColor: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: '18px', transition: 'color 0.15s ease' }}>×</button>}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <p style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '8px', fontWeight: '500' }}>ATT GÖRA</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entryTodos.map((todo, idx) => (
            <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(idx)} style={{ accentColor: theme.accent }} />
              <span style={{ textDecoration: todo.done ? 'line-through' : 'none', color: todo.done ? theme.textMuted : theme.text, flex: 1 }}>{todo.text}</span>
              <button onClick={() => removeTodo(idx)} style={{ padding: '2px 6px', border: 'none', background: 'none', color: theme.textMuted, cursor: 'pointer' }}>×</button>
            </label>
          ))}
          <input type="text" placeholder="+ Lägg till..." onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { addTodo(e.target.value.trim()); e.target.value = ''; } }} style={{ padding: '6px 0', border: 'none', backgroundColor: 'transparent', color: theme.text, outline: 'none', fontSize: '14px' }} />
        </div>
      </div>

      <div>
        <p style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '8px', fontWeight: '500' }}>ANTECKNINGAR</p>
        <textarea value={entryNotes} onChange={(e) => setNotes(prev => ({ ...prev, [key]: e.target.value }))} placeholder="Skriv anteckningar här..." style={{ width: '100%', minHeight: '60px', padding: '10px 12px', borderRadius: '10px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, resize: 'vertical', fontSize: '13px', outline: 'none', transition: 'background-color 0.15s ease' }} />
      </div>
    </div>
  );
}

function AplBanner({ aplClasses, theme }) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: '14px', marginBottom: '16px', backgroundColor: `${theme.apl}0c`, borderLeft: `3px solid ${theme.apl}` }}>
      <p style={{ fontWeight: '600', color: theme.apl, marginBottom: '4px', fontSize: '13px', letterSpacing: '-0.1px' }}>APL pågår</p>
      {aplClasses.map(a => (
        <p key={a.classId} style={{ fontSize: '13px', color: theme.text, opacity: 0.8 }}>
          {a.className}{a.description ? ` — ${a.description}` : ''}
        </p>
      ))}
    </div>
  );
}

function EmptyState({ theme, message, onAdd }) {
  return (
    <div style={{ backgroundColor: theme.bgCardSolid, borderRadius: '20px', padding: '52px', textAlign: 'center', boxShadow: theme.shadow }}>
      <p style={{ color: theme.textMuted, marginBottom: '20px', fontSize: '15px' }}>{message}</p>
      <button onClick={onAdd} style={{ padding: '12px 28px', borderRadius: '100px', border: 'none', backgroundColor: theme.accent, color: 'white', cursor: 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s ease' }}>+ Lägg till lektion</button>
    </div>
  );
}

function AddButton({ theme, onClick }) {
  return <button onClick={onClick} style={{ padding: '16px', borderRadius: '14px', border: `1.5px dashed ${theme.border}`, backgroundColor: 'transparent', color: theme.textMuted, cursor: 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s ease' }}>+ Lägg till lektion</button>;
}

function NavButton({ theme, onClick, children }) {
  return <button onClick={onClick} style={{ padding: '8px 18px', borderRadius: '100px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, cursor: 'pointer', fontWeight: '500', fontSize: '13px', transition: 'all 0.2s ease' }}>{children}</button>;
}

function Section({ title, theme, onAdd, children }) {
  return (
    <div style={{ backgroundColor: theme.bgCardSolid, borderRadius: '20px', padding: '24px', boxShadow: theme.shadowMd }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' }}>{title}</h3>
        <button onClick={onAdd} style={{ padding: '8px 18px', borderRadius: '100px', border: 'none', backgroundColor: theme.accent, color: 'white', cursor: 'pointer', fontWeight: '500', fontSize: '13px', transition: 'all 0.2s ease' }}>+ Ny</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  );
}

function ItemCard({ theme, color, title, subtitle, extra, tags, onEdit, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', backgroundColor: theme.bgHover, borderLeft: color ? `3px solid ${color}` : 'none', transition: 'background-color 0.15s ease' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: '500', fontSize: '15px', letterSpacing: '-0.1px' }}>{title}</p>
        <p style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>{subtitle}</p>
        {extra}
        {tags?.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
            {tags.map((t, i) => <span key={i} style={{ padding: '3px 8px', borderRadius: '100px', backgroundColor: t.color, color: 'white', fontSize: '10px', fontWeight: '500' }}>{t.name}</span>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button onClick={onEdit} style={{ padding: '6px 14px', borderRadius: '100px', border: 'none', backgroundColor: theme.bgTertiary, color: theme.text, cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.15s ease' }}>Redigera</button>
        <button onClick={onDelete} style={{ padding: '6px 14px', borderRadius: '100px', border: 'none', backgroundColor: `${theme.warning}18`, color: theme.warning, cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.15s ease' }}>Ta bort</button>
      </div>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange, theme, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: theme.textMuted }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, fontSize: '14px', outline: 'none', transition: 'background-color 0.15s ease' }} />
    </div>
  );
}

function Textarea({ label, value, onChange, theme, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: theme.textMuted }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, fontSize: '14px', outline: 'none', minHeight: '80px', resize: 'vertical', transition: 'background-color 0.15s ease' }} />
    </div>
  );
}

function Select({ label, value, onChange, options, theme }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500', color: theme.textMuted }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, fontSize: '14px', outline: 'none' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ModalButtons({ theme, onClose, onSave }) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
      <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '100px', border: 'none', backgroundColor: theme.bgHover, color: theme.text, cursor: 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s ease' }}>Avbryt</button>
      <button onClick={onSave} style={{ flex: 1, padding: '12px', borderRadius: '100px', border: 'none', backgroundColor: theme.accent, color: 'white', cursor: 'pointer', fontWeight: '500', fontSize: '14px', transition: 'all 0.2s ease' }}>Spara</button>
    </div>
  );
}
