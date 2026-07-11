// localStorage wrapper, namespaced under "babel:". Mirrors the vanilla site's Store.
export const Store = {
  get(k, d) {
    try {
      const v = localStorage.getItem("babel:" + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("babel:" + k, JSON.stringify(v));
    } catch (e) {
      /* ignore */
    }
  },
  del(k) {
    try {
      localStorage.removeItem("babel:" + k);
    } catch (e) {
      /* ignore */
    }
  },
};
