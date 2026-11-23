/* The admin key is held in memory only: it never touches browser storage, so
   it is gone when the tab reloads or closes and cannot be read back later. */
let adminKey = "";

export const getAdminKey = () => adminKey;
export const setAdminKey = (key) => { adminKey = key; };
export const clearAdminKey = () => { adminKey = ""; };
