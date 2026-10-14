/** The idl wordmark. Always lowercase. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="wordmark display" style={{ fontSize: size }} aria-label="idl">
      <span aria-hidden="true">
        <span className="wordmark__i">ı<span className="wordmark__dot" /></span>dl
      </span>
    </span>
  );
}
