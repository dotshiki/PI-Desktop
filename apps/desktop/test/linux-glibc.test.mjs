import assert from "node:assert/strict";
import test from "node:test";
import {
  GlibcUnsupportedError,
  LINUX_GLIBC_DISTROS,
  MIN_LINUX_GLIBC,
  assertLinuxGlibcSupported,
  formatGlibcVersion,
  glibcAtLeast,
  glibcMissingSymbol,
  hostGlibcWithinFloor,
  isGlibcUnsupportedError,
  maxNeededGlibc,
  parseGlibcVersion,
  readRuntimeGlibcVersion,
} from "../electron/main/linux-glibc.ts";

test("glibc 2.28 is the packaged Linux floor", () => {
  assert.deepEqual(MIN_LINUX_GLIBC, { major: 2, minor: 28 });
  assert.match(LINUX_GLIBC_DISTROS, /Debian 10/);
  assert.match(LINUX_GLIBC_DISTROS, /Ubuntu 20\.04/);
  assert.match(LINUX_GLIBC_DISTROS, /Debian 12/);
  assert.match(LINUX_GLIBC_DISTROS, /Fedora 36\+/);
  assert.equal(glibcAtLeast({ major: 2, minor: 28 }, MIN_LINUX_GLIBC), true);
  assert.equal(glibcAtLeast({ major: 2, minor: 35 }, MIN_LINUX_GLIBC), true);
  assert.equal(glibcAtLeast({ major: 2, minor: 39 }, MIN_LINUX_GLIBC), true);
  assert.equal(glibcAtLeast({ major: 2, minor: 27 }, MIN_LINUX_GLIBC), false);
});

test("parseGlibcVersion reads ldd and loader output", () => {
  assert.deepEqual(
    parseGlibcVersion("ldd (Debian GLIBC 2.28-10) 2.28"),
    { major: 2, minor: 28 },
  );
  assert.deepEqual(parseGlibcVersion("2.39"), { major: 2, minor: 39 });
  assert.equal(parseGlibcVersion("not a version"), null);
  assert.equal(formatGlibcVersion({ major: 2, minor: 28 }), "2.28");
});

test("maxNeededGlibc reads objdump symbol versions", () => {
  const dump = `
0000000000000000  w   DF *UND*  0000000000000000  GLIBC_2.2.5  memcpy
0000000000000000      DF *UND*  0000000000000000  GLIBC_2.27   lseek64
0000000000000000      DF *UND*  0000000000000000  GLIBC_2.28   fcntl64
`;
  assert.deepEqual(maxNeededGlibc(dump), { major: 2, minor: 28 });
  assert.equal(hostGlibcWithinFloor({ major: 2, minor: 25 }), true);
  assert.equal(hostGlibcWithinFloor({ major: 2, minor: 28 }), true);
  assert.equal(hostGlibcWithinFloor({ major: 2, minor: 31 }), false);
  assert.equal(hostGlibcWithinFloor({ major: 2, minor: 39 }), false);
  assert.equal(hostGlibcWithinFloor(null), true);
});

test("GLIBC loader errors are recognized from stderr", () => {
  assert.equal(
    glibcMissingSymbol(
      "/lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.28' not found",
    ),
    true,
  );
  assert.equal(glibcMissingSymbol("host-core exited"), false);
  assert.equal(
    isGlibcUnsupportedError(new GlibcUnsupportedError("2.27")),
    true,
  );
  assert.equal(
    isGlibcUnsupportedError(new Error("version `GLIBC_2.28' not found")),
    true,
  );
  assert.equal(isGlibcUnsupportedError(new Error("host-core exited")), false);
});

test("assertLinuxGlibcSupported throws only below the floor on Linux", () => {
  if (process.platform !== "linux") {
    assert.doesNotThrow(() =>
      assertLinuxGlibcSupported({ header: { glibcVersionRuntime: "2.27" } }),
    );
    return;
  }
  assert.doesNotThrow(() =>
    assertLinuxGlibcSupported({ header: { glibcVersionRuntime: "2.28" } }),
  );
  assert.throws(
    () => assertLinuxGlibcSupported({ header: { glibcVersionRuntime: "2.27" } }),
    GlibcUnsupportedError,
  );
  assert.deepEqual(
    readRuntimeGlibcVersion({ header: { glibcVersionRuntime: "2.41" } }),
    { major: 2, minor: 41 },
  );
});
