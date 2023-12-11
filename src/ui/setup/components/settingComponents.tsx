import React, { useEffect } from 'react';
import type { SetupComponentProps } from '../../index.js'

export const toggleSetting = (label: string) => ({ name, settings, updateKey }: SetupComponentProps) => {
  useEffect(() => {
    if (settings[name] === undefined) updateKey(name, false);
  }, [name, settings, updateKey]);

  return (
    <div>
      <input id={name} type="checkbox" value={settings && settings[name]} onChange={e => updateKey(name, e.target.checked)}/>
      <label htmlFor={name}>{label}</label>
    </div>
  );
};

export const choiceSetting = (label: string, choices: Record<string, string>) => ({ name, settings, updateKey }: SetupComponentProps) => {
  useEffect(() => {
    if (settings[name] === undefined) updateKey(name, Object.keys(choices)[0]);
  }, [name, settings, updateKey]);

  return (
    <div>
      <label>{label}: </label>
      <select value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}>
        {Object.entries(choices).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select>
    </div>
  );
};

export const textSetting = (label: string) => ({ name, settings, updateKey }: SetupComponentProps) => (
  <div>
    <label>{label}: </label>
    <input value={settings ? settings[name] || "" : ""} onChange={e => updateKey(name, e.target.value)}/>
  </div>
)

export const numberSetting = (label: string, min: number, max: number) => ({ name, settings, updateKey }: SetupComponentProps) => {
  useEffect(() => {
    if (settings[name] === undefined) updateKey(name, min);
  }, [name, settings, updateKey]);

  return (
    <div>
      <label>{label}: </label>
      <input type="number" min={min} max={max} value={settings ? settings[name] || String(min) : String(min)} onChange={e => updateKey(name, parseInt(e.target.value))}/>
    </div>
  );
};
