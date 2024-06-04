# GeniusYield Lucid SDK

Provides [Lucid](https://lucid.spacebudz.io/) SDK to interact with [GeniusYield](https://www.geniusyield.co/?lng=en) DEX. We use fork of Lucid by Anastasia Labs, namely, [`@anastasia-labs/lucid-cardano-fork`](https://www.npmjs.com/package/@anastasia-labs/lucid-cardano-fork).

## Install

Package name is [`@geniusyield/sdk`](https://www.npmjs.com/package/@geniusyield/sdk) and can be installed by your favorite package manager, for `pnpm` it would be `pnpm add @geniusyield/sdk`.

## Local Development

### Build

`pnpm build`.

### Test

Test files are located under [`test`](./tests/) directory. To run, one would need to create an `.env` file with environment variables as highlighted under [`.env.sample`](./.env.sample) file. After which, tests can be executed with `pnpm test` command.

Test files are also a great way to see how to interact with this library.