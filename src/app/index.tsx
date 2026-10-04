import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { getProfile } from '../db/queries';

// Entry: first run goes to onboarding, otherwise to the Home dashboard.
export default function Index() {
  const db = useSQLiteContext();
  const [target, setTarget] = useState<'/home' | '/onboarding' | null>(null);

  useEffect(() => {
    getProfile(db).then((p) => setTarget(p ? '/home' : '/onboarding'));
  }, [db]);

  if (!target) return null;
  return <Redirect href={target} />;
}
