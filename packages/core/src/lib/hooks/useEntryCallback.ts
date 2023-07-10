import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import isEqual from 'lodash/isEqual';
import { useCallback, useEffect, useState } from 'react';

import { updateDraft } from '@staticcms/core/actions/entries';
import { selectEditingDraft } from '@staticcms/core/reducers/selectors/entryDraft';
import { useAppDispatch, useAppSelector } from '@staticcms/core/store/hooks';
import { invokeEvent } from '../registry';
import { fileForEntry } from '../util/collection.util';
import useDebouncedCallback from './useDebouncedCallback';

import type { Collection, EntryData, Field } from '@staticcms/core/interface';

async function handleChange(
  path: string[],
  collection: string,
  field: Field,
  entry: EntryData,
  oldEntry: EntryData,
): Promise<EntryData> {
  const oldValue = get(oldEntry, path);
  const newValue = get(entry, path);

  let newEntry = cloneDeep(entry);

  if (!isEqual(oldValue, newValue)) {
    newEntry = await invokeEvent({ name: 'change', collection, field: field.name, data: newEntry });
  }

  if ('fields' in field && field.fields) {
    for (const childField of field.fields) {
      newEntry = await handleChange(
        [...path, childField.name],
        collection,
        childField,
        newEntry,
        oldEntry,
      );
    }
  }

  return newEntry;
}

interface EntryCallbackProps {
  hasChanged: boolean;
  collection: Collection;
  slug: string | undefined;
  callback: () => void;
}

export default function useEntryCallback({
  hasChanged,
  slug,
  collection,
  callback,
}: EntryCallbackProps) {
  const dispatch = useAppDispatch();

  const entry = useAppSelector(selectEditingDraft);
  const [lastEntryData, setLastEntryData] = useState<EntryData>(cloneDeep(entry?.data));

  const runUpdateCheck = useCallback(async () => {
    if (isEqual(lastEntryData, entry?.data)) {
      return;
    }

    if (hasChanged && entry) {
      const file = fileForEntry(collection, slug);
      let updatedEntryData = entry.data;

      if (file) {
        for (const field of file.fields) {
          updatedEntryData = await handleChange(
            [field.name],
            collection.name,
            field,
            updatedEntryData,
            lastEntryData,
          );
        }
      } else if ('fields' in collection) {
        for (const field of collection.fields) {
          updatedEntryData = await handleChange(
            [field.name],
            collection.name,
            field,
            updatedEntryData,
            lastEntryData,
          );
        }
      }

      if (!isEqual(updatedEntryData, entry.data)) {
        setLastEntryData(updatedEntryData);
        dispatch(updateDraft({ data: updatedEntryData }));
        callback();
        return;
      }

      setLastEntryData(entry?.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, hasChanged]);

  const debouncedRunUpdateCheck = useDebouncedCallback(runUpdateCheck, 500);

  useEffect(() => {
    debouncedRunUpdateCheck();
  }, [debouncedRunUpdateCheck]);
}
