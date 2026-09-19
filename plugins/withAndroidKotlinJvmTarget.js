const { withProjectBuildGradle } = require("expo/config-plugins");

/**
 * FIX (auditoria — "Inconsistent JVM Target Compatibility"): vários módulos
 * nativos de terceiros (ex.: react-native-worklets) têm suas tarefas
 * compileDebugKotlin mirando uma versão de JVM diferente de
 * compileDebugJavaWithJavac — Gradle recusa linkar isso.
 *
 * FIX v4: a v3 (que já resolveu o problema de resolução de módulo —
 * expo/config-plugins em vez de @expo/config-plugins, confirmado
 * funcionando: o snippet agora É injetado) também tentava reescrever
 * `android.compileOptions.sourceCompatibility/targetCompatibility` (lado
 * Java). Isso quebrou com "sourceCompatibility has been finalized" — por
 * `gradle.projectsEvaluated` rodar bem no fim da fase de configuração,
 * quando esse valor específico da AGP já está travado (lido por alguma
 * tarefa já criada). Mas essa parte nunca foi necessária: o lado Java já
 * estava correto em 21 (corrigido antes, em
 * JdkConfiguratorUtils.kt) — só o lado Kotlin ainda ficava em 17. Esta
 * versão mexe só no Kotlin, sem tocar em compileOptions.
 */
const SNIPPET_MARKER = "withAndroidKotlinJvmTarget";

const SNIPPET = `
// Injetado por plugins/withAndroidKotlinJvmTarget.js (${SNIPPET_MARKER}) — não editar manualmente aqui, editar o plugin.
gradle.projectsEvaluated {
  subprojects.each { subproject ->
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
