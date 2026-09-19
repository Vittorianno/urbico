// FIX (auditoria — branch feature/norby-local-llama): react-native-google-mobile-ads
// 16.5.0 traz play-services-ads 25.4.0, compilado com metadados Kotlin 2.3.0,
// incompatível com o Kotlin 2.1.20 deste projeto ("Module was compiled with
// an incompatible version of Kotlin"). Bug real, separado do trabalho do
// Llama local — desativado só nesta branch para não bloquear a validação
// do llama.rn. Resolver na main é tarefa separada.
//
// IMPORTANTE: react-native-google-mobile-ads é um módulo React Native
// "clássico" (não usa expo-modules-core), autolinkado pelo autolinking do
// próprio React Native CLI — NÃO pelo autolinking do Expo. A chave
// `expo.autolinking.exclude` no package.json só vale para módulos Expo;
// para excluir um módulo RN clássico do autolinking Android, o mecanismo
// correto é este arquivo.
module.exports = {
  dependencies: {
    "react-native-google-mobile-ads": {
      platforms: {
        android: null,
      },
    },
  },
};
