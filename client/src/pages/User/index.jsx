import React, { useState } from 'react';
import { useNavigate, useOutletContext } from "react-router";
import { Helmet } from "react-helmet";
import { useTranslation } from 'react-i18next';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { message, Input, Form, Button, Spin } from 'antd';
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import handleErrorContent from '@/utils/handleErrorContent';
import userService from '@/services/user';

const User = () => {
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const [user, setUser] = useOutletContext();

  const { t } = useTranslation('User');

  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);

  const handleFormOnFinish = async (values) => {
    setLoading(true);
    try {
      const res = await userService.setUserInfo(values);
      if (res) {
        setUser((prev) => {
          return {
            ...prev,
            ...res
          };
        });
      }
    } catch(e) {
      console.error(e);
      messageApi.error(`${t('Failed to save user info: ')}${handleErrorContent(e)}`);
    }
    setLoading(false);
  }

  return (
    <PageContainer
      title={t("Edit User Info")}
      breadcrumb={{}}
      onBack={() => navigate(-1)}
    >
      <Helmet>
        <title>{t("Edit User Info")} - {t('File Browser')}</title>
      </Helmet>
      {contextHolder}
      <ProCard>
        <Spin spinning={loading}>
          <Form
            key={loading}
            onFinish={handleFormOnFinish}
            initialValues={user}
            labelCol={{ xxl: 4, xl: 5, lg: 6, md: 8, sm: 8, xs: 24 }}
            wrapperCol={{ xxl: 4, xl: 6, lg: 8, md: 10, sm: 12, xs: 24 }}
            form={form}
          >
            <Form.Item
              label={t("User name")}
              name="username"
              rules={[{
                required: true
              }, {
                max: 16
              }, {
                min: 4
              }]}
            >
              <Input
                placeholder={t("Please nput your username here...")}
              />
            </Form.Item>
            <Form.Item
              label={t("Password")}
              name="password"
              rules={[{
                min: 4
              }, {
                max: 16
              }]}
            >
              <Input.Password
                placeholder={t("Please input your password here...")}
              />
            </Form.Item>
            <Form.Item
              label={t("Repeat password")}
              name="confirm"
              dependencies={['password']}
              rules={[{
                min: 4
              }, {
                max: 16
              }, ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('The new password that you entered do not match!')));
                },
              })]}
            >
              <Input.Password
                placeholder={t("Plese input your password again ...")}
              />
            </Form.Item>
            <Form.Item
              label=" "
              colon={false}
            >
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
              >{t("Save")}</Button>
              <Button
                htmlType="button"
                icon={<RollbackOutlined />}
                onClick={() => form.resetFields()}
                style={{ marginLeft: '8px' }}
              >{t("Reset")}</Button>
            </Form.Item>
          </Form>
        </Spin>
      </ProCard>
    </PageContainer>
  );
};

export default User;