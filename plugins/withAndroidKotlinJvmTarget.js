const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * FIX (auditoria — "Inconsistent JVM Target Compatibility"): vários módulos
 * nativos de terceiros (ex.: react-native-worklets) têm suas tarefas
 * compileDebugJavaWithJavac e compileDebugKotlin mirando versões
 * diferentes da JVM — Gradle recusa linkar isso. Corrigir arquivo por
 * arquivo dentro de node_modules não é sustentável (não sobrevive a um
 * novo `pnpm install`).
 *
 * FIX v2: a primeira versão usava `subprojects { afterEvaluate {...} }`,
 * mas isso não pegou pra react-native-worklets — a explicação mais
 * provável é ordem de registro: nosso `subprojects{}` é aplicado ANTES do
 * build.gradle do próprio módulo rodar, então o afterEvaluate interno dele
 * (que fixa jvmTarget="17") é registrado DEPOIS do nosso e roda por
 * último, vencendo. `gradle.projectsEvaluated` só dispara depois que TODO
 * projeto (raiz e subprojetos) já terminou sua própria fase de
 * configuração, incluindo os afterEvaluate internos deles — não tem como
 * algo rodar depois disso na fase de configuração.
 */
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
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy" && !config.modResults.contents.includes(SNIPPET_MARKER)) {
      config.modResults.contents += SNIPPET;
    }
    return config;
  });
};
