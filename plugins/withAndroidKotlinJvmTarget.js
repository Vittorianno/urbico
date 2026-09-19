const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * FIX (auditoria — "Inconsistent JVM Target Compatibility"): vários módulos
 * nativos de terceiros (ex.: react-native-worklets) têm suas tarefas
 * compileDebugJavaWithJavac e compileDebugKotlin mirando versões
 * diferentes da JVM (uma pegava 21 de alguma configuração global, a outra
 * ficava presa em 17 de um default do próprio módulo) — Gradle recusa
 * linkar isso. Corrigir arquivo por arquivo dentro de node_modules não é
 * sustentável (não sobrevive a um novo `pnpm install`). Este plugin
 * injeta, no android/build.gradle gerado pelo `expo prebuild`, um bloco
 * `subprojects` que força TODO módulo Android do projeto (o app e todas
 * as dependências nativas) a compilar Java e Kotlin para a mesma versão
 * (21) — sobrevive a qualquer prebuild novo, porque roda de novo toda vez.
 */
const SNIPPET_MARKER = "withAndroidKotlinJvmTarget";

const SNIPPET = `
// Injetado por plugins/withAndroidKotlinJvmTarget.js (${SNIPPET_MARKER}) — não editar manualmente aqui, editar o plugin.
subprojects { subproject ->
  afterEvaluate {
    if (subproject.hasProperty("android")) {
      subproject.android {
        compileOptions {
          sourceCompatibility JavaVersion.VERSION_21
          targetCompatibility JavaVersion.VERSION_21
        }
      }
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
