import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { getProfile } from '../db/queries';

// Entry: first run goes to onboarding, otherwise straight to Journal (the daily habit).
export default function Index() {
  const db = useSQLiteContext();
  const [target, setTarget] = useState<'/journal' | '/onboarding' | null>(null);

  useEffect(() => {
    getProfile(db).then((p) => setTarget(p ? '/journal' : '/onboarding'));
  }, [db]);

  if (!target) return null;
  return <Redirect href={target} />;
}
