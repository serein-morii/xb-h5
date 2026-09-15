import { ArrowLeft, Camera, CheckCircle2, HandHeart, LoaderCircle, ShieldCheck, Upload } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { API_PATHS, APP_ROUTES } from "../../lib/pathConventions";
import "./volunteer.css";

const ethnicities = ["汉族", "壮族", "回族", "满族", "维吾尔族", "苗族", "彝族", "土家族", "藏族", "蒙古族", "侗族", "布依族", "瑶族", "其他"];
const politicalOptions = ["中共党员", "中共预备党员", "共青团员", "民革党员", "民盟盟员", "民建会员", "民进会员", "农工党党员", "致公党党员", "九三学社社员", "台盟盟员", "无党派人士", "群众"];
const availabilityOptions = ["工作日", "节假日", "寒暑假", "任何时候"];

type FormState = {
  name: string; gender: string; birthDate: string; ethnicity: string; politicalStatus: string;
  phone: string; wechat: string; qq: string; idCard: string; address: string; workUnit: string; joinedDate: string;
  specialty: string; availability: string[]; suggestion: string; acceptedCommitment: boolean;
};

const today = new Date().toISOString().slice(0, 10);
const initialForm: FormState = { name: "", gender: "", birthDate: "", ethnicity: "汉族", politicalStatus: "群众", phone: "", wechat: "", qq: "", idCard: "", address: "", workUnit: "", joinedDate: today, specialty: "", availability: [], suggestion: "", acceptedCommitment: false };

export default function VolunteerJoin() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [message, setMessage] = useState("");
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function toggleAvailability(value: string) { field("availability", form.availability.includes(value) ? form.availability.filter((item) => item !== value) : [...form.availability, value]); }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage("请选择图片文件");
    if (file.size > 5 * 1024 * 1024) return setMessage("照片不能超过 5MB");
    setMessage(""); setPhoto(file); setPhotoPreview(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (!form.gender) return setMessage("请选择性别");
    if (!form.availability.length) return setMessage("请选择能够参加活动的时间");
    if (!form.acceptedCommitment) return setMessage("请阅读并同意服务承诺书");
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("application", new Blob([JSON.stringify(form)], { type: "application/json" }));
      if (photo) body.append("photo", photo);
      const result = await apiRequest<{ data?: { applicationId?: number } }>(`${API_PATHS.volunteer.public}/applications`, { auth: false, method: "POST", body });
      setSubmittedId(Number(result.data?.applicationId || 0));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { setMessage(error instanceof Error ? error.message : "提交失败，请稍后重试"); }
    finally { setSubmitting(false); }
  }

  if (submittedId) return <main className="yv-page yv-join-page"><section className="yv-success"><span><CheckCircle2 size={38} /></span><small>APPLICATION RECEIVED</small><h1>登记信息已提交</h1><p>你的申请编号是 <b>#{submittedId}</b>。负责人审核后会通过登记的联系方式与你联系。</p><a href={APP_ROUTES.volunteer}>返回鱼片志愿首页</a></section></main>;

  return <main className="yv-page yv-join-page">
    <header className="yv-header"><a className="yv-brand" href={APP_ROUTES.volunteer}><span><HandHeart size={19} /></span><b>鱼片志愿</b></a><a className="yv-back" href={APP_ROUTES.volunteer}><ArrowLeft size={15} />返回首页</a></header>
    <section className="yv-form-heading"><span>MEMBER REGISTRATION</span><h1>加入鱼片志愿</h1><p>请填写真实信息。带 * 的内容用于建立会员档案，资料仅供团队管理使用。</p></section>
    <form className="yv-form" onSubmit={submit}>
      <fieldset><legend><span>01</span><div><b>基础信息</b><small>介绍一下你自己</small></div></legend>
        <div className="yv-fields">
          <label><span>姓名 *</span><input required maxLength={30} value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="请输入真实姓名" /></label>
          <div className="yv-photo-field"><span>个人照片</span><label className="yv-photo-upload">{photoPreview ? <img src={photoPreview} alt="个人照片预览" /> : <Camera size={24} />}<input type="file" accept="image/png,image/jpeg,image/gif,image/bmp" onChange={selectPhoto} /><em><Upload size={14} />{photo ? "重新选择" : "选择照片"}</em></label></div>
          <div className="yv-choice-field"><span>性别 *</span><div>{["女", "男"].map((value) => <button type="button" className={form.gender === value ? "is-selected" : ""} onClick={() => field("gender", value)} key={value}>{value}</button>)}</div></div>
          <label><span>出生年月 *</span><input required type="date" max={today} value={form.birthDate} onChange={(e) => field("birthDate", e.target.value)} /></label>
          <label><span>民族 *</span><select required value={form.ethnicity} onChange={(e) => field("ethnicity", e.target.value)}>{ethnicities.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>政治面貌 *</span><select required value={form.politicalStatus} onChange={(e) => field("politicalStatus", e.target.value)}>{politicalOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
      </fieldset>
      <fieldset><legend><span>02</span><div><b>联系信息</b><small>便于活动通知和身份核验</small></div></legend>
        <div className="yv-fields">
          <label><span>联系方式 *</span><input required inputMode="tel" pattern="[0-9+\- ]{6,20}" maxLength={20} value={form.phone} onChange={(e) => field("phone", e.target.value)} placeholder="手机号或常用联系电话" /></label>
          <label><span>微信</span><input maxLength={60} value={form.wechat} onChange={(e) => field("wechat", e.target.value)} placeholder="选填" /></label>
          <label><span>QQ</span><input inputMode="numeric" maxLength={20} value={form.qq} onChange={(e) => field("qq", e.target.value.replace(/\D/g, ""))} placeholder="选填" /></label>
          <label><span>身份证号 *</span><input required pattern="(?:\d{15}|\d{17}[0-9Xx])" maxLength={18} value={form.idCard} onChange={(e) => field("idCard", e.target.value.toUpperCase().replace(/[^0-9X]/g, ""))} placeholder="仅用于身份核验，加密保存" /></label>
          <label className="wide"><span>联系地址 *</span><input required maxLength={255} value={form.address} onChange={(e) => field("address", e.target.value)} placeholder="请填写常住地址" /></label>
          <label><span>工作单位 *</span><input required maxLength={100} value={form.workUnit} onChange={(e) => field("workUnit", e.target.value)} placeholder="暂无可填写“无”" /></label>
        </div>
      </fieldset>
      <fieldset><legend><span>03</span><div><b>志愿信息</b><small>找到适合你的参与方式</small></div></legend>
        <div className="yv-fields">
          <label><span>加入团队时间 *</span><input required type="date" max={today} value={form.joinedDate} onChange={(e) => field("joinedDate", e.target.value)} /></label>
          <label className="wide"><span>特长 *</span><textarea required maxLength={500} value={form.specialty} onChange={(e) => field("specialty", e.target.value)} placeholder="例如驾驶、摄影、医疗急救、活动主持、物资搬运等" /></label>
          <div className="yv-choice-field wide"><span>能够参加活动的时间 *</span><div className="yv-chips">{availabilityOptions.map((value) => <button type="button" className={form.availability.includes(value) ? "is-selected" : ""} onClick={() => toggleAvailability(value)} key={value}>{value}</button>)}</div></div>
          <label className="wide"><span>对团队的意见、建议</span><textarea maxLength={1000} value={form.suggestion} onChange={(e) => field("suggestion", e.target.value)} placeholder="选填，欢迎分享你的想法" /></label>
        </div>
      </fieldset>
      <fieldset className="yv-commitment"><legend><span>04</span><div><b>服务承诺</b><small>共同守护团队的信任</small></div></legend>
        <div className="yv-commitment-copy"><h3>鱼片志愿服务承诺书</h3><p>本人自愿加入鱼片志愿，承诺尽己所能、帮助他人、服务社会，践行志愿精神，为建设团结互助、平等友爱、共同前进的美好炎陵贡献力量；维护团队形象，不以志愿者身份从事盈利或传教活动；服从合理的活动安排，认真参加培训与服务工作。</p></div>
        <label className="yv-consent"><input type="checkbox" checked={form.acceptedCommitment} onChange={(e) => field("acceptedCommitment", e.target.checked)} /><span><ShieldCheck size={17} />我已认真阅读并自愿遵守以上服务承诺</span></label>
      </fieldset>
      {message ? <p className="yv-form-message" role="alert">{message}</p> : null}
      <button className="yv-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={18} /> : <HandHeart size={18} />}{submitting ? "正在提交" : "提交登记申请"}</button>
    </form>
  </main>;
}
