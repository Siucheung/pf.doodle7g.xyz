/**
 * AES-256-GCM 加密工具模块，用于 Infisical 凭据的静态加密保护。
 *
 * 设计要点：
 *   - 使用 Node.js crypto 模块（仅服务端——禁止在客户端组件中导入）
 *   - AES-256-GCM 提供认证加密（保密性 + 完整性校验）
 *   - 每次加密使用随机 IV，确保相同明文产生不同密文
 *   - 输出格式：base64(IV || AuthTag || 密文)
 *
 * 密钥管理：
 *   - 加密密钥由 ENCRYPTION_KEY 环境变量经 SHA-256 派生得到
 *   - 生产环境必须设置强随机 ENCRYPTION_KEY（生成方式：crypto.randomBytes(32).toString('hex')）
 *   - 开发环境存在回退密钥，仅供本地开发使用
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

/** 加密算法 */
const ALGORITHM = 'aes-256-gcm'
/** IV 长度（12 字节，GCM 推荐值） */
const IV_LENGTH = 12
/** 认证标签长度（16 字节） */
const AUTH_TAG_LENGTH = 16
/** 密钥长度（32 字节 = 256 位） */
const KEY_LENGTH = 32

/**
 * 从 ENCRYPTION_KEY 环境变量派生 256 位加密密钥（SHA-256）。
 *
 * 如果未设置 ENCRYPTION_KEY：
 *   - 生产环境：抛出异常，拒绝启动
 *   - 开发环境：使用硬编码回退密钥（不安全，仅用于本地调试）
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须设置 ENCRYPTION_KEY 环境变量')
    }
    // 开发环境回退密钥——上线前务必替换
    return createHash('sha256').update('dev-encryption-key-change-in-production').digest()
  }

  return createHash('sha256').update(key).digest()
}

/**
 * 使用 AES-256-GCM 加密明文字符串。
 * 返回 base64 编码的密文，包含：IV(12) + AuthTag(16) + 密文。
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  // 拼接格式：IV(12) + AuthTag(16) + 密文
  const combined = Buffer.concat([iv, authTag, ciphertext])

  return combined.toString('base64')
}

/**
 * 解密由 encrypt() 生成的 base64 密文。
 * 自动验证 AuthTag，篡改的密文将解密失败。
 * 返回原始明文字符串。
 */
export function decrypt(encryptedBase64: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedBase64, 'base64')

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('无效的加密数据：长度不足')
  }

  const iv = combined.subarray(0, IV_LENGTH)
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}

/**
 * 生成随机加密密钥用于初始配置。
 * 将输出结果存入 ENCRYPTION_KEY 环境变量。
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex')
}
