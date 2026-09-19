const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * FIX (auditoria — "Inconsistent JVM Target Compatibility"): vários módulos
 * nativos de terceiros (ex.: react-native-worklets) têm suas tarefas
 * compileDebugJavaWithJavac e compileDebugKotlin mirando versões
 * diferentes da JVM — Gradle recusa linkar isso. Corrigir arquivo por
 * arquivo dentro de node_modules não é sustentável (não sobrevive a um
 * novo `pnpm install`).
 *
 * FIX v3: a v1 usava `subprojects { afterEvaluate {...} }` (não pegou,
 * provável problema de ordem de registro). A v2 trocou pra
 * `gradle.projectsEvaluated` mas continuou sem efeito nenhum — o snippet
 * nem chegava a aparecer no android/build.gradle gerado. Causa real
 * encontrada: o import usava `require("@expo/config-plugins")`. Com pnpm
 * (node_modules não achatado), esse pacote só existe como dependência
 * TRANSITIVA do pacote `expo` — não é resolvível a partir da raiz do
 * projeto. O caminho correto, documentado pelo próprio Expo para plugins
 * locais, é `expo/config-plugins` (subpath que o pacote `expo`, esse sim
 * dependência direta, reexporta).
 */
const { withProjectBuildGradle: _withProjectBuildGradle } = require("expo/config-plugins");
const SNIPPET_MARKER = "withAndroidKotlinJvmTarget";

const SNIPPET = `
// Injetado por plugins/withAndroidKotlinJvmTarget.js (${SNIPPET_MARKER}) — não editar manualmente aqui, editar o plugin.
gradle.projectsEvaluated {
  subprojects.each { subproject ->
    if (subproject.hasProperty("android")) {
      subproject.android.compileOptions.sourceCompatibility = JavaVersion.VERSION_21
      subproject.android.compileOptions.targetCompatibility = JavaVersion.VERSION_21
    }
    subproject.tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
      kotlinOptions {
        jvmTarget = "21"
      }
    }
  }
}
`;

module.exports = function withAndroidKotlinJvmTarget(config) {
  console.log("[urbico] withAndroidKotlinJvmTarget: plugin carregado, injetando snippet no android/build.gradle");
  return _withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy" && !config.modResults.contents.includes(SNIPPET_MARKER)) {
      config.modResults.contents += SNIPPET;
      console.log("[urbico] withAndroidKotlinJvmTarget: snippet injetado com sucesso");
    } else if (config.modResults.language !== "groovy") {
      console.warn(`[urbico] withAndroidKotlinJvmTarget: android/build.gradle não é Groovy (é "${config.modResults.language}") — snippet NÃO injetado`);
    }
    return config;
  });
};
