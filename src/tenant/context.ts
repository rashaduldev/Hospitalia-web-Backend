const { AsyncLocalStorage } = require("node:async_hooks");
const mongoose = require("mongoose");

const tenantStorage = new AsyncLocalStorage();

function runWithTenant(context, callback) {
  return tenantStorage.run(context, callback);
}

function currentTenant() {
  return tenantStorage.getStore() || null;
}

function tenantModel(name, schema, collection) {
  const baseModel = mongoose.models[name] || mongoose.model(name, schema, collection);
  const resolveModel = () => {
    const context = currentTenant();
    if (!context?.databaseName) return baseModel;
    const connection = mongoose.connection.useDb(context.databaseName, { useCache: true });
    return connection.models[name] || connection.model(name, schema, collection);
  };

  return new Proxy(baseModel, {
    get(_target, property) {
      const model = resolveModel();
      const value = model[property];
      return typeof value === "function" ? value.bind(model) : value;
    },
    construct(_target, args) {
      const Model = resolveModel();
      return new Model(...args);
    },
    apply(_target, thisArg, args) {
      const Model = resolveModel();
      return Reflect.apply(Model, thisArg, args);
    },
  });
}

module.exports = { runWithTenant, currentTenant, tenantModel };
