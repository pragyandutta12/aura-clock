// storage.js - Persistent local state for alarms, target objects, and sound preferences

const ALARMS_KEY = 'aura_alarms_v1';
const OBJECTS_KEY = 'aura_target_objects_v1';

export function getAlarms() {
  try {
    const raw = localStorage.getItem(ALARMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading alarms:', e);
    return [];
  }
}

export function saveAlarms(alarms) {
  try {
    localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
  } catch (e) {
    console.error('Error saving alarms:', e);
  }
}

export function getTargetObjects() {
  try {
    const raw = localStorage.getItem(OBJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading objects:', e);
    return [];
  }
}

export function saveTargetObjects(objects) {
  try {
    localStorage.setItem(OBJECTS_KEY, JSON.stringify(objects));
  } catch (e) {
    console.error('Error saving target objects:', e);
  }
}

export function addTargetObject(objectData) {
  const objects = getTargetObjects();
  objects.push(objectData);
  saveTargetObjects(objects);
  return objectData;
}

export function deleteTargetObject(id) {
  const objects = getTargetObjects().filter(o => o.id !== id);
  saveTargetObjects(objects);
}
