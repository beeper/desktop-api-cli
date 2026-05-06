# Changelog

## 5.0.0 (2026-05-06)

Full Changelog: [v0.3.0...v5.0.0](https://github.com/beeper/desktop-api-cli/compare/v0.3.0...v5.0.0)

### Features

* allow `-` as value representing stdin to binary-only file parameters in CLIs ([eacfea0](https://github.com/beeper/desktop-api-cli/commit/eacfea0f881332d854999d73092a4786d0b3ae33))
* **api:** add network, bridge fields to accounts ([ccd116d](https://github.com/beeper/desktop-api-cli/commit/ccd116df91e25275b2f63f53bedf9939aae8a64a))
* **api:** api update ([3c79717](https://github.com/beeper/desktop-api-cli/commit/3c797176b7ced4499d6bf3ff71f7d3a94967e026))
* **api:** api update ([3920764](https://github.com/beeper/desktop-api-cli/commit/3920764851961421776d64cf694dee1f999afa3e))
* **api:** api update ([bf4b43c](https://github.com/beeper/desktop-api-cli/commit/bf4b43c832c3b56adda72018ffd91a7dc0660966))
* better error message if scheme forgotten in CLI `*_BASE_URL`/`--base-url` ([8d976d4](https://github.com/beeper/desktop-api-cli/commit/8d976d441c86ddfaa67c8fad50a156f9374e0d16))
* binary-only parameters become CLI flags that take filenames only ([ed64986](https://github.com/beeper/desktop-api-cli/commit/ed64986c234a83e6c875a1202a7c217df9efa206))
* **cli:** add `--raw-output`/`-r` option to print raw (non-JSON) strings ([963cb22](https://github.com/beeper/desktop-api-cli/commit/963cb2275ff0b6900c09dbbd0cc45c37e745d561))
* **cli:** alias parameters in data with `x-stainless-cli-data-alias` ([301f6f2](https://github.com/beeper/desktop-api-cli/commit/301f6f2894cae408e91bb5834d50d6c16b78c28f))
* **cli:** send filename and content type when reading input from files ([b1ab49b](https://github.com/beeper/desktop-api-cli/commit/b1ab49bb30c6d4132fb9827cff19f73d83e7af5c))
* set CLI flag constant values automatically where `x-stainless-const` is set ([c332ed8](https://github.com/beeper/desktop-api-cli/commit/c332ed822bc6e94cb521620032bdcf941d4b7593))
* support passing path and query params over stdin ([5fe5a8d](https://github.com/beeper/desktop-api-cli/commit/5fe5a8d8aa02222e08a8407728d8063d08d9fdb9))


### Bug Fixes

* **cli:** correctly load zsh autocompletion ([2b1da99](https://github.com/beeper/desktop-api-cli/commit/2b1da99d8aa0d518a3a1e90126467b4eabff4a03))
* fall back to main branch if linking fails in CI ([6960f67](https://github.com/beeper/desktop-api-cli/commit/6960f674e30ae4b66c8c727accf4b140df4aa257))
* fix for failing to drop invalid module replace in link script ([5480c0e](https://github.com/beeper/desktop-api-cli/commit/5480c0e637e57e45ef1780847a2ec1638ef8550d))
* fix for off-by-one error in pagination logic ([16566c5](https://github.com/beeper/desktop-api-cli/commit/16566c5d80a77de14f33e1895ec72cfa89da99c7))
* fix quoting typo ([81a96d9](https://github.com/beeper/desktop-api-cli/commit/81a96d9880aee422f73677cdbe67134af37f6814))
* flags for nullable body scalar fields are strictly typed ([865b851](https://github.com/beeper/desktop-api-cli/commit/865b85180334a84053ebbc19c718f17c29c9d9d7))
* handle empty data set using `--format explore` ([6df0024](https://github.com/beeper/desktop-api-cli/commit/6df00248f562bbbd98e7cbccf8ddd82b35a40ae3))
* use `RawJSON` when iterating items with `--format explore` in the CLI ([4af189d](https://github.com/beeper/desktop-api-cli/commit/4af189dc0e5add5c654204e0e90c91e199de479a))


### Chores

* add documentation for ./scripts/link ([b57a694](https://github.com/beeper/desktop-api-cli/commit/b57a69441818f20bf3d1bbf949a30b65c55aa728))
* **ci:** skip lint on metadata-only changes ([d18d972](https://github.com/beeper/desktop-api-cli/commit/d18d972e88c1a03890fcbe3ba2f0dbffb06f5e48))
* **ci:** support manually triggering release workflow ([5a018e8](https://github.com/beeper/desktop-api-cli/commit/5a018e83f5f9347b262b10176639fcc24ec5f370))
* **cli:** additional test cases for `ShowJSONIterator` ([79f9f75](https://github.com/beeper/desktop-api-cli/commit/79f9f751f5fd415d9a34893e47b8409aa82dcb7c))
* **cli:** fall back to JSON when using default "explore" with non-TTY ([de64b1c](https://github.com/beeper/desktop-api-cli/commit/de64b1c7b2620be74c563e4da9ae4ff6a486555e))
* **cli:** let `--format raw` be used in conjunction with `--transform` ([c37cb3e](https://github.com/beeper/desktop-api-cli/commit/c37cb3e7e49185c7e7e398fb70a254ea8daf2456))
* **cli:** switch long lists of positional args over to param structs ([d4e5630](https://github.com/beeper/desktop-api-cli/commit/d4e5630718dc3170dac5f9efe0acfd0be2f1a390))
* **cli:** use `ShowJSONOpts` as argument to `formatJSON` instead of many positionals ([384a7f4](https://github.com/beeper/desktop-api-cli/commit/384a7f434bd6d40b626b6e635f005853f66ff917))
* **internal:** more robust bootstrap script ([888af53](https://github.com/beeper/desktop-api-cli/commit/888af53697b79c93159f9fce5e60cca4ea1e5a04))
* **internal:** update multipart form array serialization ([180bf35](https://github.com/beeper/desktop-api-cli/commit/180bf353b36de3cfee9e9497dca4558622654e18))
* mark all CLI-related tests in Go with `t.Parallel()` ([59678e1](https://github.com/beeper/desktop-api-cli/commit/59678e17b692460f3fdc03ca82ba6270d13ed460))
* modify CLI tests to inject stdout so mutating `os.Stdout` isn't necessary ([9e6fe8f](https://github.com/beeper/desktop-api-cli/commit/9e6fe8f0d1cba9d5115fba0b82f24a5938b3e7bc))
* omit full usage information when missing required CLI parameters ([8b749cf](https://github.com/beeper/desktop-api-cli/commit/8b749cf09b595e66687d4030cee0791aff7e14c4))
* switch some CLI Go tests from `os.Chdir` to `t.Chdir` ([c0de07e](https://github.com/beeper/desktop-api-cli/commit/c0de07ef35b6d776781b0347a102c3855445f0cb))
* **tests:** bump steady to v0.19.7 ([c7c519c](https://github.com/beeper/desktop-api-cli/commit/c7c519cf80adffc7cebbd3ec220227baf48672d7))
* **tests:** bump steady to v0.20.1 ([533501d](https://github.com/beeper/desktop-api-cli/commit/533501d2960fc565d5891d5f610a7feef458d0b2))
* **tests:** bump steady to v0.20.2 ([3a7b085](https://github.com/beeper/desktop-api-cli/commit/3a7b085b2130d21ee0a2b434dbaa3efada1e1bb3))
* **tests:** bump steady to v0.22.1 ([2164645](https://github.com/beeper/desktop-api-cli/commit/216464542c88aca1c22ebf0e9af3ac0eb6854a38))

## 0.3.0 (2026-03-24)

Full Changelog: [v0.2.0...v0.3.0](https://github.com/beeper/desktop-api-cli/compare/v0.2.0...v0.3.0)

### Features

* **api:** manual updates ([0770d3a](https://github.com/beeper/desktop-api-cli/commit/0770d3ad509df79341bb1067de910a4ececdc07e))


### Bug Fixes

* avoid reading from stdin unless request body is form encoded or json ([040b555](https://github.com/beeper/desktop-api-cli/commit/040b5552613ef61130225e1f6cf81ab213d3a4a9))
* better support passing client args in any position ([9100cf6](https://github.com/beeper/desktop-api-cli/commit/9100cf6e1ee5b4e7c7bcb262636fe3f458224cd4))
* cli no longer hangs when stdin is attached to a pipe with empty input ([4842b1e](https://github.com/beeper/desktop-api-cli/commit/4842b1eb8edf8b1bef423780f23908e10f317631))
* fix for test cases with newlines in YAML and better error reporting ([c997492](https://github.com/beeper/desktop-api-cli/commit/c9974925c5d60aa534b8d619e51594cab0d622f0))
* improve linking behavior when developing on a branch not in the Go SDK ([c5964a1](https://github.com/beeper/desktop-api-cli/commit/c5964a17c6203b0de179d6c73c62665c8c33e364))
* improved workflow for developing on branches ([e7e8488](https://github.com/beeper/desktop-api-cli/commit/e7e84887ed26fb2de032a1960ea881fb15c7b3c4))
* no longer require an API key when building on production repos ([f38af96](https://github.com/beeper/desktop-api-cli/commit/f38af96666a55ffd4014c4f6190f5807df8b740e))
* only set client options when the corresponding CLI flag or env var is explicitly set ([923b0eb](https://github.com/beeper/desktop-api-cli/commit/923b0ebdeeafe5aa17f416651d82ee20c643fd16))


### Chores

* **internal:** codegen related update ([2a0195e](https://github.com/beeper/desktop-api-cli/commit/2a0195ef893339e931434cc30db149f45a0479aa))
* **internal:** tweak CI branches ([e727f07](https://github.com/beeper/desktop-api-cli/commit/e727f07b8f5f6792c0e67fd6a048cfdd91ab3ba3))
* **internal:** update gitignore ([4b48c83](https://github.com/beeper/desktop-api-cli/commit/4b48c838b1e7afe2cf6545b0de8a4f3146e4e1dd))
* **tests:** bump steady to v0.19.4 ([f4cc892](https://github.com/beeper/desktop-api-cli/commit/f4cc892fc179e321e0b75e381f68805fd732774e))
* **tests:** bump steady to v0.19.5 ([097fdc8](https://github.com/beeper/desktop-api-cli/commit/097fdc85a1790b8687763f7e187645bbcba22f93))
* **tests:** bump steady to v0.19.6 ([4af2dce](https://github.com/beeper/desktop-api-cli/commit/4af2dce0afd3741d445d75a85bf4523a9297dcbe))


### Refactors

* **tests:** switch from prism to steady ([e67e839](https://github.com/beeper/desktop-api-cli/commit/e67e839be04bd2da13cc0a941047a8552f95a32b))

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
