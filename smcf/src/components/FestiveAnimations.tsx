import { useEffect, useState } from "react";

const FestiveAnimations = () => {
  const [snowflakes, setSnowflakes] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    // Generate snowflakes
    const flakes = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 5 + Math.random() * 10,
    }));
    setSnowflakes(flakes);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Snowflakes */}
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute text-white opacity-70 animate-fall blur-[1.5px]"
          style={{
            left: `${flake.left}%`,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
            top: "-10px",
            fontSize: `${Math.random() * 10 + 10}px`,
          }}
        >
          ❄
        </div>
      ))}

      {/* Christmas lights */}
      <div className="absolute top-0 left-0 right-0 flex justify-around py-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full animate-twinkle blur-[2px]"
            style={{
              backgroundColor: ['#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff'][i % 5],
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Festive badges/ornaments */}
      <div className="absolute top-10 right-10 animate-swing">
        <div className="text-6xl blur-[1.5px]">🎄</div>
      </div>
      
      <div className="absolute top-20 left-10 animate-bounce-slow">
        <div className="text-5xl blur-[1.5px]">🎅</div>
      </div>

      <div className="absolute bottom-20 right-20 animate-spin-slow">
        <div className="text-5xl blur-[2px]">⭐</div>
      </div>

      <div className="absolute bottom-32 left-20 animate-pulse-slow">
        <div className="text-4xl blur-[1.5px]">🎁</div>
      </div>

      {/* Festive message banner */}
      <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-80 pointer-events-none">
        <div className="bg-gradient-to-r from-red-600 via-green-600 to-red-600 text-white px-8 py-3 rounded-full shadow-2xl animate-pulse-slow">
          <span className="text-xl font-bold">🎄 Happy Holidays! 🎅</span>
        </div>
      </div>

      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0.8;
          }
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(0.8);
          }
        }

        @keyframes swing {
          0%, 100% {
            transform: rotate(-5deg);
          }
          50% {
            transform: rotate(5deg);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }

        .animate-fall {
          animation: fall linear infinite;
        }

        .animate-twinkle {
          animation: twinkle 1.5s ease-in-out infinite;
        }

        .animate-swing {
          animation: swing 3s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default FestiveAnimations;
