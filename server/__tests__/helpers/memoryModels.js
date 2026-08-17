import mongoose from "mongoose";

const stores = { projects: [], drafts: [], leads: [] };

export function resetStores() {
  for (const documents of Object.values(stores)) documents.length = 0;
}

export function stored(type) {
  return stores[type];
}

function valueAt(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function matches(document, query) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = valueAt(document, key);
    if (expected && typeof expected === "object" && "$lte" in expected) return actual <= expected.$lte;
    return String(actual) === String(expected);
  });
}

function document(value) {
  return value && { ...value, toObject: () => ({ ...value }) };
}

function queryResult(getValue) {
  const query = {
    sort(spec) {
      const [path, direction] = Object.entries(spec)[0];
      const values = [...getValue()].sort((a, b) => direction * (valueAt(a, path) < valueAt(b, path) ? 1 : -1));
      return queryResult(() => values);
    },
    limit(count) {
      return queryResult(() => getValue().slice(0, count));
    },
    lean() {
      return Promise.resolve(getValue());
    },
    then(resolve, reject) {
      return Promise.resolve(getValue()).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(getValue()).catch(reject);
    }
  };
  return query;
}

function applyUpdate(target, update) {
  for (const [key, value] of Object.entries(update)) {
    if (key.includes(".")) {
      const parts = key.split(".");
      const leaf = parts.pop();
      const parent = parts.reduce((item, part) => (item[part] ??= {}), target);
      parent[leaf] = value;
    } else target[key] = value;
  }
}

export const Project = {
  find(query) {
    return queryResult(() => stores.projects.filter((item) => matches(item, query)));
  },
  findOne(query) {
    return queryResult(() => document(stores.projects.find((item) => matches(item, query))) || null);
  },
  countDocuments(query) {
    return Promise.resolve(stores.projects.filter((item) => matches(item, query)).length);
  },
  async create(value) {
    if (stores.projects.some((item) => item.slug === value.slug)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    const now = new Date();
    const item = { _id: new mongoose.Types.ObjectId(), showcase: {}, ...structuredClone(value), createdAt: now, updatedAt: now };
    stores.projects.push(item);
    return document(item);
  },
  async findOneAndUpdate(query, update) {
    const item = stores.projects.find((candidate) => matches(candidate, query));
    if (!item) return null;
    applyUpdate(item, structuredClone(update));
    item.updatedAt = new Date();
    return document(item);
  },
  async findOneAndDelete(query) {
    const index = stores.projects.findIndex((item) => matches(item, query));
    return index < 0 ? null : document(stores.projects.splice(index, 1)[0]);
  }
};

export const Draft = {
  findOne(query) {
    return queryResult(() => document(stores.drafts.find((item) => matches(item, query))) || null);
  },
  async findOneAndUpdate(query, update) {
    let item = stores.drafts.find((candidate) => matches(candidate, query));
    if (!item && stores.drafts.some((candidate) => candidate.ownerLogin === update.ownerLogin)) {
      throw Object.assign(new Error("duplicate"), { code: 11000 });
    }
    if (!update.parameters || !Number.isInteger(update.rowCount) || update.rowCount < 1 || update.rowCount > 200 || !Number.isInteger(update.currentRow) || update.currentRow < 1) {
      throw new Error("validation failed");
    }
    if (!item) {
      item = { _id: new mongoose.Types.ObjectId() };
      stores.drafts.push(item);
    }
    applyUpdate(item, structuredClone(update));
    return document(item);
  }
};

export const Lead = {
  async create(value) {
    const item = { _id: new mongoose.Types.ObjectId(), ...structuredClone(value), createdAt: new Date() };
    stores.leads.push(item);
    return item;
  },
  find() {
    return queryResult(() => stores.leads);
  }
};
