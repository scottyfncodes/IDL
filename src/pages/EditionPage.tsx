import { isPlayable, localEditionDate } from '../lib/date';
import { goBack, href } from '../app/router';
import { IconBack } from '../ui/icons';
import { EditionHeading, EditionLineup } from './EditionView';
import { NotFound } from './States';

export function EditionPage({ date }: { date: string }) {
  const today = localEditionDate();
  if (!isPlayable(date, today)) return <NotFound title="No edition that day" message="Pick a date from the archive in the Library." />;
  return (
    <div className="page page--sub">
      <div className="subnav">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => goBack('/library')}>
          <IconBack />
        </button>
        {date !== today && <a className="text-link" href={href('/today')}>Today’s edition</a>}
      </div>
      <EditionHeading date={date} isToday={date === today} />
      <EditionLineup date={date} />
    </div>
  );
}
