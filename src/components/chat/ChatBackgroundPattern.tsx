const ChatBackgroundPattern = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.07] dark:opacity-[0.05]">
    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="chat-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          {/* Paper plane */}
          <g transform="translate(20, 20) rotate(15)">
            <path d="M0 0 L16 8 L6 10 L4 16 Z" fill="currentColor" />
            <path d="M6 10 L16 8 L4 16 Z" fill="currentColor" opacity="0.6" />
          </g>

          {/* Heart */}
          <g transform="translate(90, 30)">
            <path d="M8 14s-5.5-4-5.5-7.5a3 3 0 0 1 5.5-1.5 3 3 0 0 1 5.5 1.5c0 3.5-5.5 7.5-5.5 7.5z" fill="currentColor" />
          </g>

          {/* Star */}
          <g transform="translate(160, 15)">
            <path d="M8 0l2.5 5 5.5.8-4 3.9.9 5.3L8 12.5 3.1 15l.9-5.3-4-3.9 5.5-.8z" fill="currentColor" />
          </g>

          {/* Chat bubble */}
          <g transform="translate(50, 80)">
            <path d="M2 0h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6l-4 3v-3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="currentColor" />
          </g>

          {/* Smile */}
          <g transform="translate(130, 75)">
            <circle cx="8" cy="8" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5.5" cy="6" r="1" fill="currentColor" />
            <circle cx="10.5" cy="6" r="1" fill="currentColor" />
            <path d="M5 10.5a3.5 3.5 0 0 0 6 0" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* Camera */}
          <g transform="translate(15, 140)">
            <rect x="0" y="3" width="16" height="11" rx="2" fill="currentColor" />
            <circle cx="8" cy="9" r="3.5" fill="currentColor" opacity="0.4" />
            <rect x="5" y="0" width="6" height="4" rx="1" fill="currentColor" />
          </g>

          {/* Music note */}
          <g transform="translate(100, 140)">
            <circle cx="4" cy="13" r="3" fill="currentColor" />
            <rect x="6.5" y="2" width="1.5" height="11" fill="currentColor" />
            <path d="M7 2 Q12 0 12 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Cloud */}
          <g transform="translate(160, 130)">
            <path d="M6 14h10a4 4 0 0 0 .9-7.9A5 5 0 0 0 7.2 4 4.5 4.5 0 0 0 2.5 10 3.5 3.5 0 0 0 6 14z" fill="currentColor" />
          </g>

          {/* Pin / Location */}
          <g transform="translate(55, 165)">
            <path d="M8 0a5 5 0 0 0-5 5c0 4 5 10 5 10s5-6 5-10a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" fill="currentColor" />
          </g>

          {/* Small dots scattered */}
          <circle cx="40" cy="60" r="2" fill="currentColor" />
          <circle cx="120" cy="55" r="1.5" fill="currentColor" />
          <circle cx="180" cy="95" r="2" fill="currentColor" />
          <circle cx="75" cy="120" r="1.5" fill="currentColor" />
          <circle cx="145" cy="110" r="2" fill="currentColor" />
          <circle cx="30" cy="185" r="1.5" fill="currentColor" />
          <circle cx="175" cy="175" r="2" fill="currentColor" />

          {/* Paper plane small */}
          <g transform="translate(140, 50) rotate(-10) scale(0.7)">
            <path d="M0 0 L16 8 L6 10 L4 16 Z" fill="currentColor" />
          </g>

          {/* Pencil */}
          <g transform="translate(85, 175) rotate(-30)">
            <rect x="0" y="0" width="3" height="14" rx="0.5" fill="currentColor" />
            <path d="M0 14 L1.5 18 L3 14Z" fill="currentColor" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#chat-pattern)" />
    </svg>
  </div>
);

export default ChatBackgroundPattern;
