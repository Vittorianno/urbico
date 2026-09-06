module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push("@babel/plugin-transform-private-methods");
  plugins.push("@babel/plugin-transform-class-properties");
  plugins.push("@babel/plugin-transform-private-property-in-object");

  plugins.push("react-native-worklets/plugin");

  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins,
  };
};
