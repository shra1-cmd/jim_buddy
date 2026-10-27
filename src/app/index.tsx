import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { getProfile } from '../db/queries';
import { getSetting } from '../db/settings';

// Entry: the welcome note once, then onboarding on first run, otherwise the Home dashboard.
export default function Index() {
  const db = useSQLiteContext();
  const [target, setTarget] = useState<'/home' | '/onboarding' | '/welcome' | null>(null);

  useEffect(() => {
    Promise.all([getSetting(db, 'welcome_seen_at'), getProfile(db)]).then(([seen, p]) =>
      setTarget(!seen ? '/welcome' : p ? '/home' : '/onboarding'),
    );
  }, [db]);

  if (!target) return null;
  return <Redirect href={target} />;
}
