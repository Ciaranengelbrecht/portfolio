// Migration v8: Backfill Session.localDate for existing sessions lacking it.
import { db } from '../db';
import { Session } from '../types';

export async function migrateToV8_LocalDate(){
  try {
    const sessions = await db.getAll<Session>('sessions');
    let changed = 0;
    for(const s of sessions){
      if(!(s as any).localDate && s.dateISO){
        try {
          const d = new Date(s.dateISO);
            if(!isNaN(d.getTime())){
              const localDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              (s as any).localDate = localDate;
              await db.put('sessions', s);
              changed++;
            }
        } catch {}
      }
    }
    console.log(`[migrateToV8_LocalDate] updated ${changed} sessions`);
  } catch(e){ console.warn('[migrateToV8_LocalDate] error', e); }
}
