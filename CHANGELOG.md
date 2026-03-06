# Changelog

## 0.2.0 (2026-03-06)

Full Changelog: [v0.1.1...v0.2.0](https://github.com/beeper/desktop-api-cli/compare/v0.1.1...v0.2.0)

### Features

* add `--max-items` flag for paginated/streaming endpoints ([d2cd184](https://github.com/beeper/desktop-api-cli/commit/d2cd184ffe8bd8bef28411f35c23c9e0bbed958f))
* add support for file downloads from binary response endpoints ([2e0b0a7](https://github.com/beeper/desktop-api-cli/commit/2e0b0a7080adef772b1c2b9f33d957f267d354ad))
* improved documentation and flags for client options ([46e772c](https://github.com/beeper/desktop-api-cli/commit/46e772c72af1ea406d17ddaa7aeaf58e8b917a16))
* support passing required body params through pipes ([4aa3f99](https://github.com/beeper/desktop-api-cli/commit/4aa3f993788d31566b0035a34134b4745ccd6643))


### Bug Fixes

* add missing client parameter flags to test cases ([83e3537](https://github.com/beeper/desktop-api-cli/commit/83e35370ae87614bba0c4deacdafcbd6614ed4ee))
* add missing example parameters for test cases ([86b6743](https://github.com/beeper/desktop-api-cli/commit/86b6743be9efd4809bfdfbf02da29089121e680c))
* avoid printing usage errors twice ([62fbdae](https://github.com/beeper/desktop-api-cli/commit/62fbdaedc3cf1724fc9102eae7dcb87e148aabb7))
* fix for encoding arrays with `any` type items ([148ce2c](https://github.com/beeper/desktop-api-cli/commit/148ce2c1a8fe9b284fb29a4397c8904a0e366824))
* more gracefully handle empty stdin input ([d758018](https://github.com/beeper/desktop-api-cli/commit/d75801861b11dfd1cb5568e2b5da3eb0176b7c21))


### Chores

* **ci:** skip uploading artifacts on stainless-internal branches ([858bf53](https://github.com/beeper/desktop-api-cli/commit/858bf533863314ae579e4bd8a3fc25ff1b0490d4))
* **internal:** codegen related update ([2fcd536](https://github.com/beeper/desktop-api-cli/commit/2fcd53660f6195309b786d5b50aaeb22595a5404))
* **test:** do not count install time for mock server timeout ([c89d312](https://github.com/beeper/desktop-api-cli/commit/c89d31244a0735738964709d9c15961c2f9a2a71))
* zip READMEs as part of build artifact ([d1a1267](https://github.com/beeper/desktop-api-cli/commit/d1a12679c7c0366a8a50972010874bc9e9a6d643))

## 0.1.1 (2026-02-25)

Full Changelog: [v0.1.0...v0.1.1](https://github.com/beeper/desktop-api-cli/compare/v0.1.0...v0.1.1)

### Bug Fixes

* pin formatting for headers to always use repeat/dot formats ([97ea814](https://github.com/beeper/desktop-api-cli/commit/97ea81439b3abccbcdaeb1fdd393e44e6a07aa6e))


### Chores

* update readme with better instructions for installing with homebrew ([b248f13](https://github.com/beeper/desktop-api-cli/commit/b248f13f6bf455a224a85fa97af2c17122c53101))

## 0.1.0 (2026-02-24)

Full Changelog: [v0.0.1...v0.1.0](https://github.com/beeper/desktop-api-cli/compare/v0.0.1...v0.1.0)

### ⚠ BREAKING CHANGES

* add support for passing files as parameters

### Features

* add readme documentation for passing files as arguments ([f7b1b4a](https://github.com/beeper/desktop-api-cli/commit/f7b1b4af1c7220c9cd21afc58aba32508504073b))
* add support for passing files as parameters ([49ca642](https://github.com/beeper/desktop-api-cli/commit/49ca642691b546494d700c2f782aa8ae88d9767e))
* **api:** add cli ([c57f02a](https://github.com/beeper/desktop-api-cli/commit/c57f02af602f2def16c59c1ba1db4059ff2b0fd5))
* **api:** add reactions ([b16c08a](https://github.com/beeper/desktop-api-cli/commit/b16c08ae98ca116514ce0a8977142db49196c5d9))
* **api:** add upload asset and edit message endpoints ([da2ca66](https://github.com/beeper/desktop-api-cli/commit/da2ca66a4910e80ffd919fd8105b026497b9a0ea))
* **api:** api update ([56afbbc](https://github.com/beeper/desktop-api-cli/commit/56afbbc6d75f019edac752e6100caefe333de434))
* **api:** api update ([9f69525](https://github.com/beeper/desktop-api-cli/commit/9f69525f394b74266a664c50899f760525844cd8))
* **api:** manual updates ([0c8a0ee](https://github.com/beeper/desktop-api-cli/commit/0c8a0ee510531e30ce5ed8748af4b56c19cf2433))
* **api:** manual updates ([b3fb2a0](https://github.com/beeper/desktop-api-cli/commit/b3fb2a0cf62fff27da2f2d1ca8062bf3b3ede582))
* **api:** manual updates ([b66f2b5](https://github.com/beeper/desktop-api-cli/commit/b66f2b5c68eb90c5644faf0c1f2fc67a94f100cb))
* **client:** provide file completions when using file embed syntax ([bdf34ce](https://github.com/beeper/desktop-api-cli/commit/bdf34cecc8cdbd2e9d19dade4616970bfd43ae6a))
* **cli:** improve shell completions for namespaced commands and flags ([eded84a](https://github.com/beeper/desktop-api-cli/commit/eded84a5cc05bb700f5d0c50add30ec257738aa0))
* improved support for passing files for `any`-typed arguments ([8c8fa87](https://github.com/beeper/desktop-api-cli/commit/8c8fa8743cbfd67e8ddbf165a06c151d319e2612))


### Bug Fixes

* fix for file uploads to octet stream and form encoding endpoints ([f26b475](https://github.com/beeper/desktop-api-cli/commit/f26b475dce7f9eb0cc9fa5a20c26667e1c32fc1a))
* fix for nullable arguments ([5f10511](https://github.com/beeper/desktop-api-cli/commit/5f105117110982a972554fb9ab720b354829bae4))
* fix for when terminal width is not available ([eba0a3f](https://github.com/beeper/desktop-api-cli/commit/eba0a3f905f7eb7bc3cd9a8f571713e5bdff1f87))
* fix mock tests with inner fields that have underscores ([7c4554a](https://github.com/beeper/desktop-api-cli/commit/7c4554a35871394eeed6927ee401ce7cc6fe99b8))
* preserve filename in content-disposition for file uploads ([c230cef](https://github.com/beeper/desktop-api-cli/commit/c230cefdf540e6d49e102cbb9cb9010625be04c6))
* prevent tests from hanging on streaming/paginated endpoints ([fcf4608](https://github.com/beeper/desktop-api-cli/commit/fcf4608ef721212651ce3839bd4885d0b86744cf))
* restore support for void endpoints ([de2984b](https://github.com/beeper/desktop-api-cli/commit/de2984b4cec53693f0b5b684cdc498c410211a82))
* use RawJSON for iterated values instead of re-marshalling ([06bc1c7](https://github.com/beeper/desktop-api-cli/commit/06bc1c7a0ba890d76e2c210476ad1d7586cd069a))


### Chores

* add build step to ci ([f2bddcf](https://github.com/beeper/desktop-api-cli/commit/f2bddcf00a9a3faacf1a1a8293f3f46b7befe187))
* configure new SDK language ([6db7b30](https://github.com/beeper/desktop-api-cli/commit/6db7b300c46fd6331b4bada5759f5e31ed5a0b56))
* configure new SDK language ([388b391](https://github.com/beeper/desktop-api-cli/commit/388b3910792deb197365fc9e5fbf266260845d9e))
* **internal:** codegen related update ([1cfe60b](https://github.com/beeper/desktop-api-cli/commit/1cfe60b670c95b1e9840d9768b8b5936512919aa))
* **internal:** codegen related update ([8e91787](https://github.com/beeper/desktop-api-cli/commit/8e91787eccfac7cc9455444fca72045a312f95a0))
* **internal:** codegen related update ([46e5aef](https://github.com/beeper/desktop-api-cli/commit/46e5aefac484dd40ad069ea5500dd2c885abf611))
* **internal:** codegen related update ([6987a4c](https://github.com/beeper/desktop-api-cli/commit/6987a4c5870caa9323a8be80124069fc5f28d45a))
* update documentation in readme ([5633fad](https://github.com/beeper/desktop-api-cli/commit/5633fad79b0a5db1d66b83a58d1d0e8fe7cf3f1d))
