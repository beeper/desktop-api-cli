import Command0 from './commands/accounts/add.js'
import Command1 from './commands/accounts/list.js'
import Command2 from './commands/accounts/remove.js'
import Command3 from './commands/accounts/show.js'
import Command4 from './commands/accounts/use.js'
import Command5 from './commands/api/get.js'
import Command6 from './commands/api/post.js'
import Command7 from './commands/api/request.js'
import Command8 from './commands/auth/email/response.js'
import Command9 from './commands/auth/email/start.js'
import Command10 from './commands/auth/logout.js'
import Command11 from './commands/auth/status.js'
import Command12 from './commands/autocomplete.js'
import Command13 from './commands/bridges/config.js'
import Command14 from './commands/bridges/delete.js'
import Command15 from './commands/bridges/list.js'
import Command16 from './commands/bridges/login.js'
import Command17 from './commands/bridges/login-password.js'
import Command18 from './commands/bridges/logout.js'
import Command19 from './commands/bridges/proxy.js'
import Command20 from './commands/bridges/register.js'
import Command21 from './commands/bridges/run.js'
import Command22 from './commands/bridges/show.js'
import Command23 from './commands/bridges/whoami.js'
import Command24 from './commands/chats/archive.js'
import Command25 from './commands/chats/avatar.js'
import Command26 from './commands/chats/description.js'
import Command27 from './commands/chats/disappear.js'
import Command28 from './commands/chats/draft.js'
import Command29 from './commands/chats/focus.js'
import Command30 from './commands/chats/list.js'
import Command31 from './commands/chats/mark-read.js'
import Command32 from './commands/chats/mark-unread.js'
import Command33 from './commands/chats/mute.js'
import Command34 from './commands/chats/notify-anyway.js'
import Command35 from './commands/chats/pin.js'
import Command36 from './commands/chats/priority.js'
import Command37 from './commands/chats/remind.js'
import Command38 from './commands/chats/rename.js'
import Command39 from './commands/chats/search.js'
import Command40 from './commands/chats/show.js'
import Command41 from './commands/chats/start.js'
import Command42 from './commands/chats/unarchive.js'
import Command43 from './commands/chats/unmute.js'
import Command44 from './commands/chats/unpin.js'
import Command45 from './commands/chats/unremind.js'
import Command46 from './commands/completion.js'
import Command47 from './commands/config/get.js'
import Command48 from './commands/config/path.js'
import Command49 from './commands/config/reset.js'
import Command50 from './commands/config/set.js'
import Command51 from './commands/contacts/list.js'
import Command52 from './commands/contacts/search.js'
import Command53 from './commands/contacts/show.js'
import Command54 from './commands/docs.js'
import Command55 from './commands/doctor.js'
import Command56 from './commands/export.js'
import Command57 from './commands/install/desktop.js'
import Command58 from './commands/install/server.js'
import Command59 from './commands/man.js'
import Command60 from './commands/media/download.js'
import Command61 from './commands/messages/context.js'
import Command62 from './commands/messages/delete.js'
import Command63 from './commands/messages/edit.js'
import Command64 from './commands/messages/export.js'
import Command65 from './commands/messages/list.js'
import Command66 from './commands/messages/search.js'
import Command67 from './commands/messages/show.js'
import Command68 from './commands/plugins.js'
import Command69 from './commands/plugins/available.js'
import Command70 from './commands/presence.js'
import Command71 from './commands/resolve/account.js'
import Command72 from './commands/resolve/bridge.js'
import Command73 from './commands/resolve/chat.js'
import Command74 from './commands/resolve/contact.js'
import Command75 from './commands/resolve/target.js'
import Command76 from './commands/rpc.js'
import Command77 from './commands/schema.js'
import Command78 from './commands/send/file.js'
import Command79 from './commands/send/react.js'
import Command80 from './commands/send/sticker.js'
import Command81 from './commands/send/text.js'
import Command82 from './commands/send/unreact.js'
import Command83 from './commands/send/voice.js'
import Command84 from './commands/setup.js'
import Command85 from './commands/status.js'
import Command86 from './commands/targets/add/desktop.js'
import Command87 from './commands/targets/add/remote.js'
import Command88 from './commands/targets/add/server.js'
import Command89 from './commands/targets/disable.js'
import Command90 from './commands/targets/enable.js'
import Command91 from './commands/targets/list.js'
import Command92 from './commands/targets/logs.js'
import Command93 from './commands/targets/remove.js'
import Command94 from './commands/targets/restart.js'
import Command95 from './commands/targets/show.js'
import Command96 from './commands/targets/start.js'
import Command97 from './commands/targets/status.js'
import Command98 from './commands/targets/stop.js'
import Command99 from './commands/targets/use.js'
import Command100 from './commands/update.js'
import Command101 from './commands/verify.js'
import Command102 from './commands/verify/approve.js'
import Command103 from './commands/verify/cancel.js'
import Command104 from './commands/verify/list.js'
import Command105 from './commands/verify/qr-confirm.js'
import Command106 from './commands/verify/qr-scan.js'
import Command107 from './commands/verify/recovery-key.js'
import Command108 from './commands/verify/reset-recovery-key.js'
import Command109 from './commands/verify/sas.js'
import Command110 from './commands/verify/sas-confirm.js'
import Command111 from './commands/verify/show.js'
import Command112 from './commands/verify/start.js'
import Command113 from './commands/verify/status.js'
import Command114 from './commands/version.js'
import Command115 from './commands/watch.js'

export const commands = {
  'accounts': Command1,
  'accounts:add': Command0,
  'accounts:chats': Command30,
  'accounts:list': Command1,
  'accounts:remove': Command2,
  'accounts:show': Command3,
  'accounts:use': Command4,
  'api:get': Command5,
  'api:post': Command6,
  'api:request': Command7,
  'auth:email:response': Command8,
  'auth:email:start': Command9,
  'auth:logout': Command10,
  'auth:status': Command11,
  'autocomplete': Command12,
  'bridges': Command15,
  'bridges:c': Command13,
  'bridges:config': Command13,
  'bridges:d': Command14,
  'bridges:delete': Command14,
  'bridges:l': Command16,
  'bridges:list': Command15,
  'bridges:login': Command16,
  'bridges:login-password': Command17,
  'bridges:logout': Command18,
  'bridges:p': Command17,
  'bridges:proxy': Command19,
  'bridges:r': Command20,
  'bridges:register': Command20,
  'bridges:run': Command21,
  'bridges:show': Command22,
  'bridges:w': Command23,
  'bridges:whoami': Command23,
  'bridges:x': Command19,
  'chats': Command30,
  'chats:archive': Command24,
  'chats:avatar': Command25,
  'chats:description': Command26,
  'chats:disappear': Command27,
  'chats:draft': Command28,
  'chats:focus': Command29,
  'chats:list': Command30,
  'chats:mark-read': Command31,
  'chats:mark-unread': Command32,
  'chats:mute': Command33,
  'chats:notify-anyway': Command34,
  'chats:pin': Command35,
  'chats:priority': Command36,
  'chats:remind': Command37,
  'chats:rename': Command38,
  'chats:search': Command39,
  'chats:show': Command40,
  'chats:start': Command41,
  'chats:unarchive': Command42,
  'chats:unmute': Command43,
  'chats:unpin': Command44,
  'chats:unremind': Command45,
  'completion': Command46,
  'config:get': Command47,
  'config:path': Command48,
  'config:reset': Command49,
  'config:set': Command50,
  'contacts': Command51,
  'contacts:list': Command51,
  'contacts:search': Command52,
  'contacts:show': Command53,
  'docs': Command54,
  'doctor': Command55,
  'export': Command56,
  'install:desktop': Command57,
  'install:server': Command58,
  'ls': Command30,
  'man': Command59,
  'media:download': Command60,
  'messages:context': Command61,
  'messages:delete': Command62,
  'messages:edit': Command63,
  'messages:export': Command64,
  'messages:list': Command65,
  'messages:search': Command66,
  'messages:show': Command67,
  'plugins': Command68,
  'plugins:available': Command69,
  'presence': Command70,
  'resolve:account': Command71,
  'resolve:bridge': Command72,
  'resolve:chat': Command73,
  'resolve:contact': Command74,
  'resolve:target': Command75,
  'rpc': Command76,
  'schema': Command77,
  'search': Command66,
  'send': Command81,
  'send:file': Command78,
  'send:react': Command79,
  'send:sticker': Command80,
  'send:text': Command81,
  'send:unreact': Command82,
  'send:voice': Command83,
  'setup': Command84,
  'status': Command85,
  'targets': Command91,
  'targets:add:desktop': Command86,
  'targets:add:remote': Command87,
  'targets:add:server': Command88,
  'targets:disable': Command89,
  'targets:enable': Command90,
  'targets:list': Command91,
  'targets:logs': Command92,
  'targets:remove': Command93,
  'targets:restart': Command94,
  'targets:show': Command95,
  'targets:start': Command96,
  'targets:status': Command97,
  'targets:stop': Command98,
  'targets:use': Command99,
  'update': Command100,
  'verify': Command101,
  'verify:approve': Command102,
  'verify:cancel': Command103,
  'verify:list': Command104,
  'verify:qr-confirm': Command105,
  'verify:qr-scan': Command106,
  'verify:recovery-key': Command107,
  'verify:reset-recovery-key': Command108,
  'verify:sas': Command109,
  'verify:sas-confirm': Command110,
  'verify:show': Command111,
  'verify:start': Command112,
  'verify:status': Command113,
  'version': Command114,
  'watch': Command115,
}
