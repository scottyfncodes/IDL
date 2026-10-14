import { href } from '../app/router';
import { Button } from '../ui/Button';

export function Loading() {
  return (
    <div className="state-screen" aria-busy="true">
      <span className="loader" aria-label="Loading" />
    </div>
  );
}

export function NotFound({ title = 'Nothing here', message = 'That page wandered off.' }: { title?: string; message?: string }) {
  return (
    <div className="state-screen">
      <h1 className="display">{title}</h1>
      <p className="muted">{message}</p>
      <a className="btn btn--primary btn--md" href={href('/today')}><span>Go to today</span></a>
    </div>
  );
}

export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state-screen">
      <h1 className="display">Couldn’t open this game</h1>
      <p className="muted">
        It may not have finished downloading before you went offline. Reconnect once and idl will keep it for next time.
      </p>
      <div className="button-row">
        <Button variant="primary" onClick={() => { onRetry(); }}>Try again</Button>
        <a className="btn btn--quiet btn--md" href={href('/today')}><span>Go to today</span></a>
      </div>
    </div>
  );
}
