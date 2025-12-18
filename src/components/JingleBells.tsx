const JingleBells = () => {
  return (
    <>
      {/* Top Left Bell */}
      <div className="fixed top-4 left-4 z-40 animate-swing-bell">
        <div className="text-5xl drop-shadow-lg cursor-pointer hover:scale-110 transition-transform blur-[2px]">
          🔔
        </div>
      </div>

      {/* Top Right Bell */}
      <div className="fixed top-4 right-4 z-40 animate-swing-bell" style={{ animationDelay: '0.5s' }}>
        <div className="text-5xl drop-shadow-lg cursor-pointer hover:scale-110 transition-transform blur-[2px]">
          🔔
        </div>
      </div>

      {/* Bottom Left Bell */}
      <div className="fixed bottom-4 left-4 z-40 animate-swing-bell" style={{ animationDelay: '1s' }}>
        <div className="text-5xl drop-shadow-lg cursor-pointer hover:scale-110 transition-transform blur-[2px]">
          🔔
        </div>
      </div>

      {/* Bottom Right Bell */}
      <div className="fixed bottom-4 right-4 z-40 animate-swing-bell" style={{ animationDelay: '1.5s' }}>
        <div className="text-5xl drop-shadow-lg cursor-pointer hover:scale-110 transition-transform blur-[2px]">
          🔔
        </div>
      </div>

      <style>{`
        @keyframes swing-bell {
          0%, 100% {
            transform: rotate(-10deg);
          }
          50% {
            transform: rotate(10deg);
          }
        }

        .animate-swing-bell {
          animation: swing-bell 2s ease-in-out infinite;
          transform-origin: top center;
        }
      `}</style>
    </>
  );
};

export default JingleBells;
