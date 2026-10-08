export default function Home() {
  return (
    <main className="paytable-home">

      {/* Background decoration */}
      <div className="paytable-glow paytable-glow-one" />
      <div className="paytable-glow paytable-glow-two" />

      {/* Main content */}
      <section className="paytable-hero">

        {/* Brand */}
        <div className="paytable-brand">
          <div className="paytable-brand-mark">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3.5"
                y="3.5"
                width="17"
                height="17"
                rx="5"
                stroke="currentColor"
                strokeWidth="1.7"
              />

              <path
                d="M8 12.2L10.6 14.8L16.2 9.4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <span>Pay At Table</span>
        </div>


        {/* Main heading */}
        <div className="paytable-heading">

          <div className="paytable-eyebrow">
            SIMPLE • SECURE • CONVENIENT
          </div>

          <h1>
            Scan.
            <span> Review.</span>
            <br />
            Pay.
          </h1>

          <p>
            A simpler way to settle your restaurant bill.
            <br className="desktop-break" />
            No app. No waiting. Just scan and pay.
          </p>

        </div>


        {/* Payment visual */}
        <div className="paytable-payment-visual">

          <div className="paytable-ring paytable-ring-one" />
          <div className="paytable-ring paytable-ring-two" />

          <div className="paytable-payment-card">

            <div className="paytable-check">

              <svg
                width="42"
                height="42"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />

                <path
                  d="M8.5 12.2L10.8 14.5L15.6 9.7"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

            </div>

            <div className="paytable-payment-title">
              Bill ready
            </div>

            <div className="paytable-payment-subtitle">
              Ready when you are
            </div>

          </div>

        </div>


        {/* Instructions */}
        <div className="paytable-instruction">

          <div className="paytable-instruction-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M4 4H9V9H4V4Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />

              <path
                d="M15 4H20V9H15V4Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />

              <path
                d="M4 15H9V20H4V15Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />

              <path
                d="M15 15H17"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              <path
                d="M20 15V20H15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <strong>Scan the QR code at your table</strong>

            <span>
              View your bill, add a tip and pay securely.
            </span>
          </div>

        </div>


        {/* Features */}
        <div className="paytable-features">

          <div className="paytable-feature">
            <div className="paytable-feature-icon">
              ✓
            </div>

            <span>
              Secure payment
            </span>
          </div>


          <div className="paytable-feature-divider" />


          <div className="paytable-feature">
            <div className="paytable-feature-icon">
              ✓
            </div>

            <span>
              No app required
            </span>
          </div>


          <div className="paytable-feature-divider" />


          <div className="paytable-feature">
            <div className="paytable-feature-icon">
              ✓
            </div>

            <span>
              Fast & easy
            </span>
          </div>

        </div>

      </section>


      {/* Footer */}
      <footer className="paytable-footer">
        <span>Pay At Table</span>
        <span className="paytable-footer-dot">•</span>
        <span>Secure restaurant payments</span>
      </footer>

    </main>
  );
}