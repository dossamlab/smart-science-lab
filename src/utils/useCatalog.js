import { useEffect, useMemo, useState } from 'react';
import { casListData } from '../data/casListData';
import { useAppConfig } from '../context/AppConfigContext';
import { mergeCatalog } from './chemSearch';

/** School reagent list: the built-in catalog plus rows teachers add in the spreadsheet (via Code.gs ?type=chemicals). */
export function useCatalog() {
  const { config } = useAppConfig();
  const gasUrl = config.gasUrl?.trim();
  const [sheetRows, setSheetRows] = useState([]);

  useEffect(() => {
    if (!gasUrl) return;
    let active = true;
    fetch(`${gasUrl}?type=chemicals`)
      .then(r => r.json())
      .then(res => { if (active && res.status === 'success') setSheetRows(res.data?.chemicals || []); })
      .catch(() => {});
    return () => { active = false; };
  }, [gasUrl]);

  return useMemo(() => mergeCatalog(casListData, sheetRows), [sheetRows]);
}
