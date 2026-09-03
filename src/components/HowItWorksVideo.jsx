import React, { useEffect, useState } from 'react';

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768;

const SCENE_DURATIONS = [4000, 4500, 4500, 4000, 4500];

const C = {
  cyan: '#22d3ee',
  emerald: '#10b981',
  violet: '#8b5cf6',
  green: '#10b981',
  pink: '#ec4899',
  yellow: '#fbbf24',
};

const ease = 'cubic-bezier(0.16, 1, 0.3, 1)';
const spring = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function tr(show, hideTx = 'translateY(20px)', dur = '0.5s', delay = '0s', easing = ease) {
  return {
    transition: `opacity ${dur} ${easing} ${delay}, transform ${dur} ${easing} ${delay}, filter ${dur} ${easing} ${delay}`,
    opacity: show ? 1 : 0,
    transform: show ? 'none' : hideTx,
    pointerEvents: show ? 'auto' : 'none',
  };
}

function SceneFade({ children, sceneKey }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className="absolute inset-0 z-10"
      style={{
        transition: `opacity 0.6s ${ease}`,
        opacity: visible ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

function Scene1() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10">
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '22vw', height: '22vw',
          background: 'radial-gradient(circle, rgba(34,211,238,0.15), transparent)',
          transition: `transform 2s ${ease}`,
          transform: phase >= 2 ? 'scale(1.5)' : 'scale(1)',
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '15vw', height: '15vw', left: '20%', top: '20%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12), transparent)',
          transition: `transform 2s ${ease} 0.3s, opacity 2s ${ease} 0.3s`,
          transform: phase >= 2 ? 'scale(1.3)' : 'scale(0.8)',
          opacity: phase >= 2 ? 1 : 0,
        }}
      />
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '18vw', height: '18vw', right: '15%', bottom: '20%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent)',
          transition: `transform 2s ${ease} 0.5s, opacity 2s ${ease} 0.5s`,
          transform: phase >= 2 ? 'scale(1.4)' : 'scale(0.8)',
          opacity: phase >= 2 ? 1 : 0,
        }}
      />

      <div className="relative">
        <h1 className="font-bold tracking-tight leading-none mb-4" style={{ fontSize: '6vw' }}>
          {'CALLIOTEL'.split('').map((char, i) => (
            <span
              key={i}
              className="inline-block"
              style={{
                background: `linear-gradient(135deg, ${i < 4 ? C.cyan : i < 7 ? C.emerald : C.violet}, white)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transition: `opacity 0.4s ${spring} ${phase >= 1 ? i * 0.05 : 0}s, transform 0.4s ${spring} ${phase >= 1 ? i * 0.05 : 0}s`,
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? 'none' : 'translateY(30px)',
              }}
            >
              {char}
            </span>
          ))}
        </h1>
        <p
          style={{
            fontSize: '2vw', color: C.emerald,
            ...tr(phase >= 2, 'translateY(20px) blur(5px)', '0.8s', '0s'),
            filter: phase >= 2 ? 'none' : 'blur(5px)',
          }}
        >
          Virtual phone numbers from $1.99
        </p>

        <div className="flex justify-center mt-8" style={{ gap: '2vw' }}>
          {[
            { val: '804+', label: 'Supported Services', color: C.cyan, glow: 'rgba(34,211,238,0.25)' },
            { val: '4', label: 'Countries', color: C.violet, glow: 'rgba(139,92,246,0.25)' },
            { val: '$1.99', label: 'Starting Price', color: C.emerald, glow: 'rgba(16,185,129,0.25)' },
          ].map(({ val, label, color, glow }, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-xl"
              style={{
                background: 'rgba(15,23,42,0.85)',
                border: `1px solid ${color}44`,
                boxShadow: `0 0 24px ${glow}`,
                padding: '1.5vw 2vw',
                transition: `opacity 0.5s ${spring} ${0.1 + i * 0.12}s, transform 0.5s ${spring} ${0.1 + i * 0.12}s`,
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? 'none' : 'translateY(30px) scale(0.8)',
              }}
            >
              <span className="font-bold" style={{ fontSize: '3vw', color }}>{val}</span>
              <span className="text-slate-300" style={{ fontSize: '1vw' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Scene2() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  const countries = [
    { name: 'United States', flag: '🇺🇸', color: C.cyan, selected: true },
    { name: 'United Kingdom', flag: '🇬🇧', color: C.violet },
    { name: 'Canada', flag: '🇨🇦', color: C.emerald },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="flex items-center" style={{ width: '80vw', gap: '5vw' }}>
        <div style={{ width: '50%' }}>
          <div
            className="font-bold tracking-widest uppercase"
            style={{ fontSize: '1.5vw', marginBottom: '2vh', color: C.emerald, ...tr(phase >= 1) }}
          >
            Step 1
          </div>
          <h2
            className="font-bold text-white leading-tight"
            style={{ fontSize: '4.5vw', marginBottom: '3vh', ...tr(phase >= 2, 'translateX(-30px)', '0.5s') }}
          >
            Choose Country &amp; Service
          </h2>
          <p
            className="text-slate-300"
            style={{ fontSize: '1.5vw', ...tr(phase >= 2, 'translateY(0px)', '0.8s', '0.2s') }}
          >
            Select from 4 countries (US, UK, Canada, Australia) and 804+ services — social apps, banks, gaming, and more.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center" style={{ width: '50%', gap: '2vh' }}>
          {countries.map(({ name, flag, color, selected }, i) => (
            <div
              key={i}
              className="flex items-center rounded-lg border w-full"
              style={{
                padding: '2vh',
                gap: '2vw',
                background: selected ? `${color}22` : 'rgba(15,23,42,0.5)',
                borderColor: selected ? color : 'rgb(51,65,85)',
                boxShadow: selected ? `0 0 24px ${color}30` : 'none',
                transition: `opacity 0.5s ${spring} ${i * 0.1}s, transform 0.5s ${spring} ${i * 0.1}s`,
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? 'none' : 'translateX(50px)',
              }}
            >
              <span style={{ fontSize: '2.5vw' }}>{flag}</span>
              <span className="font-semibold text-white" style={{ fontSize: '1.5vw' }}>{name}</span>
              {selected && (
                <div
                  className="ml-auto rounded-full flex items-center justify-center"
                  style={{
                    width: '2vw', height: '2vw', background: color,
                    transition: `transform 0.4s ${spring} 0.8s`,
                    transform: phase >= 3 ? 'scale(1)' : 'scale(0)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" style={{ width: '1vw', height: '1vw' }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Scene3() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2200),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="flex items-center flex-row-reverse" style={{ width: '80vw', gap: '5vw' }}>
        <div style={{ width: '50%' }}>
          <div
            className="font-bold tracking-widest uppercase"
            style={{ fontSize: '1.5vw', marginBottom: '2vh', color: C.violet, ...tr(phase >= 1) }}
          >
            Step 2
          </div>
          <h2
            className="font-bold text-white leading-tight"
            style={{ fontSize: '4.5vw', marginBottom: '3vh', ...tr(phase >= 2, 'translateX(30px)', '0.5s') }}
          >
            Get Your Number Instantly
          </h2>
          <p
            className="text-slate-300"
            style={{ fontSize: '1.5vw', ...tr(phase >= 2, 'translateY(0px)', '0.8s', '0.2s') }}
          >
            Active in seconds. Bulk purchasing available for 10–50 numbers at once.
          </p>
        </div>

        <div className="flex justify-center items-center" style={{ width: '50%' }}>
          <div
            className="rounded-2xl text-center"
            style={{
              background: 'linear-gradient(135deg, #0f172a, #120826)',
              border: `2px solid ${C.violet}`,
              boxShadow: `0 0 50px ${C.violet}40`,
              padding: '3vw',
              transition: `opacity 0.6s ${spring}, transform 0.6s ${spring}`,
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? 'none' : 'scale(0.5)',
            }}
          >
            <div
              className="text-slate-400 uppercase tracking-wider"
              style={{
                fontSize: '1.2vw', marginBottom: '1vh',
                transition: `opacity 0.4s ${ease}`,
                opacity: phase >= 4 ? 1 : 0,
              }}
            >
              Your Virtual Number
            </div>
            <div
              className="font-mono font-bold tracking-widest"
              style={{
                fontSize: '4vw',
                background: `linear-gradient(135deg, ${C.violet}, ${C.cyan})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transition: `opacity 0.5s ${ease}, filter 0.5s ${ease}`,
                opacity: phase >= 4 ? 1 : 0,
                filter: phase >= 4 ? 'none' : 'blur(10px)',
              }}
            >
              +1 (555) 019-2834
            </div>
            <div
              className="inline-flex items-center rounded-full border"
              style={{
                marginTop: '3vh', gap: '1vw',
                background: `${C.green}20`, padding: '0.5vh 1.5vw',
                fontSize: '1.2vw', color: C.green,
                borderColor: `${C.green}60`,
                transition: `transform 0.4s ${spring} 0.4s`,
                transform: phase >= 4 ? 'scale(1)' : 'scale(0)',
              }}
            >
              <div
                className="rounded-full"
                style={{ width: '0.8vw', height: '0.8vw', background: C.green, animation: phase >= 4 ? 'pulse-dot 1.2s infinite' : 'none' }}
              />
              Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MSG_ITEMS = [
  {
    service: 'Social Network',
    dot: '#25d366',
    time: 'Just now',
    msg: <><span style={{ color: '#94a3b8' }}>Your verification code is: </span><span style={{ color: C.cyan, fontWeight: 'bold' }}>729-104</span></>,
    delay: 0,
  },
  {
    service: 'Banking App',
    dot: '#F5A623',
    time: '2m ago',
    msg: 'Login code: 49201. Do not share.',
    delay: 0.1,
    dim: true,
  },
];

function Scene4() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 2200),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="flex items-center" style={{ width: '80vw', gap: '5vw' }}>
        <div style={{ width: '50%' }}>
          <div
            className="font-bold tracking-widest uppercase"
            style={{ fontSize: '1.5vw', marginBottom: '2vh', color: C.green, ...tr(phase >= 1) }}
          >
            Step 3
          </div>
          <h2
            className="font-bold text-white leading-tight"
            style={{ fontSize: '4.5vw', marginBottom: '3vh', ...tr(phase >= 2, 'translateX(-30px)', '0.5s') }}
          >
            Receive SMS &amp; Verify
          </h2>
          <p
            className="text-slate-300"
            style={{ fontSize: '1.5vw', ...tr(phase >= 2, 'translateY(0px)', '0.8s', '0.2s') }}
          >
            SMS and voice arrive instantly inside the platform. Perfect for verifications and privacy.
          </p>

          <div style={{ display: 'flex', gap: '1vw', marginTop: '2vh', flexWrap: 'wrap' }}>
            {[
              { label: 'Instant delivery', color: C.green },
              { label: 'Privacy protected', color: C.violet },
              { label: 'Always available', color: C.emerald },
            ].map(({ label, color }, i) => (
              <div
                key={i}
                style={{
                  background: `${color}18`, border: `1px solid ${color}40`,
                  borderRadius: 100, padding: '0.4vh 1.2vw',
                  color, fontSize: '1vw', fontWeight: 700,
                  transition: `opacity 0.4s ${spring} ${0.4 + i * 0.1}s, transform 0.4s ${spring} ${0.4 + i * 0.1}s`,
                  opacity: phase >= 2 ? 1 : 0,
                  transform: phase >= 2 ? 'none' : 'scale(0.7)',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center items-center" style={{ width: '50%' }}>
          <div
            className="rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: '#0f172a', border: `1px solid ${C.cyan}40`,
              width: '100%', maxWidth: '30vw', boxShadow: `0 0 40px ${C.cyan}15`,
              transition: `opacity 0.5s ${spring}, transform 0.5s ${spring}`,
              opacity: phase >= 3 ? 1 : 0,
              transform: phase >= 3 ? 'none' : 'translateY(50px)',
            }}
          >
            <div className="flex justify-between items-center" style={{ background: 'rgb(15,23,42)', padding: '1.5vh 2vh', borderBottom: `1px solid ${C.cyan}25` }}>
              <span className="text-white font-medium" style={{ fontSize: '1.2vw' }}>Messages</span>
              <div
                style={{
                  width: '0.7vw', height: '0.7vw', borderRadius: '50%', background: C.green,
                  animation: phase >= 3 ? 'pulse-dot 1.5s infinite' : 'none',
                }}
              />
            </div>

            <div style={{ padding: '2vh', display: 'flex', flexDirection: 'column', gap: '2vh' }}>
              {MSG_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg"
                  style={{
                    background: item.dim ? 'rgba(30,41,59,0.5)' : 'rgb(30,41,59)',
                    padding: '1.5vh',
                    border: `1px solid ${item.dim ? 'rgba(51,65,85,0.5)' : C.cyan + '35'}`,
                    boxShadow: item.dim ? 'none' : `0 0 16px ${C.cyan}15`,
                    transition: `opacity 0.5s ${spring} ${item.delay}s, transform 0.5s ${spring} ${item.delay}s`,
                    opacity: phase >= 4 ? (item.dim ? 0.55 : 1) : 0,
                    transform: phase >= 4 ? 'none' : 'translateX(20px)',
                  }}
                >
                  <div className="flex items-center justify-between" style={{ marginBottom: '0.6vh', gap: '0.8vw' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6vw' }}>
                      <div style={{ width: '0.8vw', height: '0.8vw', borderRadius: '50%', background: item.dot, flexShrink: 0 }} />
                      <span className="text-slate-300 font-semibold" style={{ fontSize: '1vw' }}>{item.service}</span>
                    </div>
                    <span className="text-slate-500" style={{ fontSize: '0.9vw' }}>{item.time}</span>
                  </div>
                  <div className="text-white" style={{ fontSize: '1.2vw', paddingLeft: '1.4vw' }}>{item.msg}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene5() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center text-center z-10"
      style={{ background: 'rgba(2,6,23,0.5)' }}
    >
      <div
        className="absolute"
        style={{
          width: '100vw', height: '2px', top: '50%', transform: 'translateY(-50%)',
          background: `linear-gradient(90deg, ${C.violet}, ${C.cyan}, ${C.emerald})`,
          transition: `transform 1.5s ease-in-out`,
          transformOrigin: 'left center',
          transform: phase >= 1 ? 'translateY(-50%) scaleX(1)' : 'translateY(-50%) scaleX(0)',
        }}
      />

      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: '30vw', height: '30vw',
          background: `radial-gradient(circle, ${C.emerald}18, transparent)`,
          transition: `transform 3s ${ease}`,
          animation: phase >= 2 ? 'orb-pulse 3s infinite' : 'none',
          transform: phase >= 2 ? 'scale(1)' : 'scale(0.5)',
        }}
      />

      <div className="relative" style={{ background: 'rgba(2,6,23,0.92)', padding: '2vh 4vw', borderRadius: 24 }}>
        <h1
          className="font-bold tracking-tight leading-none"
          style={{
            fontSize: '7vw', marginBottom: '1rem',
            background: `linear-gradient(135deg, ${C.cyan}, ${C.emerald}, ${C.violet})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            transition: `opacity 0.6s ${spring}, transform 0.6s ${spring}`,
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'none' : 'scale(0.8)',
          }}
        >
          CALLIOTEL.COM
        </h1>
        <p
          className="text-slate-300"
          style={{ fontSize: '2.5vw', ...tr(phase >= 3) }}
        >
          Trusted by power users and businesses worldwide.
        </p>

        <div
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '1vw',
            marginTop: '3vh', padding: '0.8vh 2vw',
            background: `linear-gradient(135deg, ${C.emerald}, ${C.violet})`,
            borderRadius: 100, color: '#fff',
            fontSize: '1.5vw', fontWeight: 700,
            ...tr(phase >= 3, 'translateY(20px)', '0.8s', '0.2s'),
          }}
        >
          Start for Free Today
        </div>
      </div>
    </div>
  );
}

export default function HowItWorksVideo() {
  const [currentScene, setCurrentScene] = useState(0);
  const [prevScene, setPrevScene] = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTransitioning(true);
      setTimeout(() => {
        setPrevScene(currentScene);
        setCurrentScene(prev => (prev + 1) % 5);
        setTransitioning(false);
      }, 400);
    }, SCENE_DURATIONS[currentScene]);
    return () => clearTimeout(timer);
  }, [currentScene]);

  const scenes = [Scene1, Scene2, Scene3, Scene4, Scene5];
  const SceneComponent = scenes[currentScene];

  const SCENE_COLORS = [C.cyan, C.emerald, C.violet, C.green, C.emerald];

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
      <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', overflow: 'hidden', background: '#020617', borderRadius: '12px' }}>
        {!isMobile() && (
          <video
            src={`${process.env.PUBLIC_URL}/videos/network-bg.mp4`}
            autoPlay loop muted playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #020617 10%, transparent 60%, rgba(2,6,23,0.4))' }} />

        <div
          className="absolute"
          style={{
            width: '1px', height: '8rem', filter: 'blur(2px)',
            background: SCENE_COLORS[currentScene],
            transition: `left 2s ${ease}, top 2s ${ease}, transform 2s ${ease}, opacity 0.5s ${ease}`,
            left: ['10vw', '40vw', '60vw', '80vw', '50vw'][currentScene],
            top: ['20vh', '70vh', '15vh', '60vh', '40vh'][currentScene],
            transform: `rotate(${[15, -15, 45, -45, 90][currentScene]}deg) scale(${[1, 2, 1.5, 0.8, 4][currentScene]})`,
            opacity: currentScene === 4 ? 0 : 0.35,
          }}
        />

        <div
          key={currentScene}
          style={{
            position: 'absolute', inset: 0,
            transition: `opacity 0.4s ${ease}`,
            opacity: transitioning ? 0 : 1,
          }}
        >
          <SceneComponent />
        </div>

        <div style={{ position: 'absolute', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              style={{
                width: i === currentScene ? '28px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === currentScene ? SCENE_COLORS[i] : 'rgba(255,255,255,0.2)',
                boxShadow: i === currentScene ? `0 0 8px ${SCENE_COLORS[i]}` : 'none',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
